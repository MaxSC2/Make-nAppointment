"""
Генератор реалистичных тестовых DICOM-изображений.

Генерирует синтетические медицинские изображения, похожие на:
  - КТ грудной клетки (10 срезов)
  - МРТ головного мозга (8 срезов)
  - Рентген грудной клетки (1 снимок)
  - УЗИ брюшной полости (1 снимок)

Загрузка в Orthanc через REST API.

Зависимости: pip install numpy pillow pydicom requests
"""

import uuid
import io
import requests
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from pydicom.dataset import Dataset, FileMetaDataset
from datetime import datetime

ORTHANC_URL = "http://localhost:8042"

# ---------------------------------------------------------------
# Генерация изображений
# ---------------------------------------------------------------

def make_ct_chest_slice(size: int = 256, slice_idx: int = 0) -> np.ndarray:
    """КТ грудной клетки — synthetic cross-section with lungs"""
    img = np.zeros((size, size), dtype=np.uint16)
    mid = size // 2

    # Тело (окружность)
    Y, X = np.ogrid[:size, :size]
    body_mask = (X - mid)**2 + (Y - mid)**2 < (mid - 10)**2
    img[body_mask] = 50  # мягкие ткани ~50 HU

    # Лёгкие (два круга с воздухом)
    for cx in [mid - 40, mid + 40]:
        lung_mask = (X - cx)**2 + (Y - mid + 10)**2 < 55**2
        img[lung_mask] = 20  # лёгкое ~-800 HU (но scale 0-255 для 16-bit)

    # Позвоночник (маленький круг в центре сзади)
    spine_mask = (X - mid)**2 + (Y - mid + 40)**2 < 15**2
    img[spine_mask] = 200  # кость ~1000 HU

    # Добавляем шум
    noise = np.random.randint(0, 10, (size, size), dtype=np.uint16)
    img = np.clip(img.astype(np.int32) + noise.astype(np.int32), 0, 65535).astype(np.uint16)

    return img


def make_mr_brain_slice(size: int = 256, slice_idx: int = 0) -> np.ndarray:
    """МРТ головного мозга"""
    img = np.ones((size, size), dtype=np.uint16) * 30
    mid = size // 2

    Y, X = np.ogrid[:size, :size]

    # Голова (овал)
    head_mask = ((X - mid) / 0.8)**2 + (Y - mid - 10)**2 < (mid - 15)**2
    img[head_mask] = 60

    # Мозг (внутренний овал)
    brain_mask = ((X - mid) / 0.75)**2 + (Y - mid)**2 < (mid - 35)**2
    img[brain_mask] = 100

    # Желудочки (тёмные области)
    vent_mask = ((X - mid) / 0.3)**2 + (Y - mid + 5)**2 < 12**2
    img[vent_mask] = 40

    # Добавляем шум
    noise = np.random.randint(0, 8, (size, size), dtype=np.uint16)
    img = np.clip(img.astype(np.int32) + noise.astype(np.int32), 0, 65535).astype(np.uint16)

    return img


def make_dx_chest() -> np.ndarray:
    """Рентген грудной клетки (PA view)"""
    size = 512
    img = np.ones((size, size), dtype=np.uint16) * 120
    mid = size // 2

    Y, X = np.ogrid[:size, :size]
    Y = np.broadcast_to(Y, (size, size))
    X = np.broadcast_to(X, (size, size))

    # Лёгкие (два больших овала)
    for cx in [mid - 70, mid + 70]:
        lung = ((X - cx) / 0.7)**2 + (Y - mid + 20)**2 < (mid - 30)**2
        img[lung] = 60

    # Средостение (сердце + сосуды)
    heart = ((X - mid + 10) / 0.5)**2 + (Y - mid + 40)**2 < 55**2
    img[heart] = 160

    # Диафрагма
    diaph = (Y > mid + 80) & (Y < mid + 120)
    img[diaph] = 180

    # Рёбра (горизонтальные линии)
    for ry in range(mid - 80, mid + 60, 18):
        if 0 <= ry < size:
            rib = np.abs(Y - ry) < 3
            img[rib] = 200

    noise = np.random.randint(0, 12, (size, size), dtype=np.uint16)
    img = np.clip(img.astype(np.int32) + noise.astype(np.int32), 0, 65535).astype(np.uint16)

    return img


def make_us_abdomen() -> np.ndarray:
    """УЗИ брюшной полости (B-mode)"""
    size = 400
    img = np.zeros((size, size), dtype=np.uint16)

    Y, X = np.ogrid[:size, :size]
    Y = np.broadcast_to(Y, (size, size))
    X = np.broadcast_to(X, (size, size))
    mid = size // 2

    # Сектор УЗИ (конус)
    angle = np.arctan2(Y - mid + 50, X - mid)
    sector = (angle > -1.2) & (angle < 1.2) & (Y > mid - 120) & (Y < mid + 80)

    # Заполнение сектора
    img[sector] = 30

    # Ткани / границы
    boundary = (Y > mid - 20) & (Y < mid + 10) & sector
    img[boundary] = 120

    # Печень (овал справа)
    liver = ((X - mid - 60) / 0.6)**2 + (Y - mid + 10)**2 < 50**2
    img[liver & sector] = 80

    # Почка (овал слева)
    kidney = ((X - mid + 50) / 0.3)**2 + (Y - mid + 20)**2 < 20**2
    img[kidney & sector] = 50

    # Спекл-шум (характерный для УЗИ)
    speckle = np.random.randint(0, 15, (size, size), dtype=np.uint16)
    img = np.clip(img.astype(np.int32) + speckle.astype(np.int32), 0, 65535).astype(np.uint16)

    return img


# ---------------------------------------------------------------
# DICOM generation
# ---------------------------------------------------------------

def make_uid() -> str:
    return str(uuid.uuid4().int)[:15]


def create_dicom_with_image(
    patient: dict,
    pixel_array: np.ndarray,
    study_uid: str,
    series_uid: str,
    instance_uid: str,
    instance_number: int = 1,
    series_description: str = "",
) -> Dataset:
    modality = patient.get("Modality", "CT")

    # SOP Class UID по модальности
    sop_uids = {
        "CT": "1.2.840.10008.5.1.4.1.1.2",
        "MR": "1.2.840.10008.5.1.4.1.1.4",
        "DX": "1.2.840.10008.5.1.4.1.1.1.1",
        "US": "1.2.840.10008.5.1.4.1.1.6.1",
    }
    sop_class = sop_uids.get(modality, "1.2.840.10008.5.1.4.1.1.2")

    file_meta = FileMetaDataset()
    file_meta.MediaStorageSOPClassUID = sop_class
    file_meta.MediaStorageSOPInstanceUID = instance_uid
    file_meta.ImplementationClassUID = f"1.2.840.{make_uid()}"
    file_meta.ImplementationVersionName = "PACS_RIS_QUEUE"

    rows, cols = pixel_array.shape

    ds = Dataset()
    ds.file_meta = file_meta

    # Patient
    ds.PatientName = patient["PatientName"]
    ds.PatientID = patient["PatientID"]
    ds.PatientSex = patient.get("PatientSex", "O")
    ds.PatientBirthDate = patient.get("PatientBirthDate", "20000101")

    # Study
    ds.StudyDate = datetime.now().strftime("%Y%m%d")
    ds.StudyTime = datetime.now().strftime("%H%M%S")
    ds.StudyDescription = patient.get("StudyDescription", "")
    ds.StudyInstanceUID = study_uid
    ds.AccessionNumber = str(uuid.uuid4())[:8].upper()

    # Series
    ds.SeriesDate = ds.StudyDate
    ds.SeriesDescription = series_description or patient.get("StudyDescription", "")
    ds.SeriesInstanceUID = series_uid
    ds.SeriesNumber = "1"
    ds.Modality = modality
    ds.ProtocolName = patient.get("StudyDescription", "")

    # Equipment
    ds.Manufacturer = "PACS-RIS-Queue Simulator"
    ds.ManufacturerModelName = "Synthetic-1.0"
    ds.DeviceSerialNumber = "SIM-001"

    # Image
    ds.SOPClassUID = sop_class
    ds.SOPInstanceUID = instance_uid
    ds.InstanceNumber = str(instance_number)

    ds.Rows = rows
    ds.Columns = cols
    ds.BitsAllocated = 16
    ds.BitsStored = 16
    ds.HighBit = 15
    ds.PixelRepresentation = 0
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = "MONOCHROME2"

    # Pixel data
    ds.PixelData = pixel_array.tobytes()

    # Rescale (для HU в КТ)
    if modality == "CT":
        ds.RescaleIntercept = "-1024"
        ds.RescaleSlope = "1"
        ds.RescaleType = "HU"

    ds.is_implicit_VR = False
    ds.is_little_endian = True

    return ds


def upload_to_orthanc(ds: Dataset) -> dict | None:
    buf = io.BytesIO()
    ds.save_as(buf)
    dicom_bytes = buf.getvalue()
    resp = requests.post(
        f"{ORTHANC_URL}/instances",
        data=dicom_bytes,
        headers={"Content-Type": "application/dicom"},
    )
    if resp.status_code == 200:
        return resp.json()
    else:
        print(f"  Ошибка {resp.status_code}: {resp.text[:100]}")
        return None


# ---------------------------------------------------------------
# Пациенты и исследования
# ---------------------------------------------------------------

PATIENTS = [
    {
        "PatientName": "Иванов^Иван^Иванович",
        "PatientID": "001",
        "PatientSex": "M",
        "PatientBirthDate": "19800515",
        "StudyDescription": "КТ грудной клетки",
        "Modality": "CT",
        "num_slices": 10,
        "generator": make_ct_chest_slice,
    },
    {
        "PatientName": "Петрова^Анна^Сергеевна",
        "PatientID": "002",
        "PatientSex": "F",
        "PatientBirthDate": "19920320",
        "StudyDescription": "МРТ головного мозга",
        "Modality": "MR",
        "num_slices": 8,
        "generator": make_mr_brain_slice,
    },
    {
        "PatientName": "Сидоров^Пётр^Алексеевич",
        "PatientID": "003",
        "PatientSex": "M",
        "PatientBirthDate": "19671102",
        "StudyDescription": "Рентгенография грудной клетки",
        "Modality": "DX",
        "num_slices": 1,
        "generator": lambda *a: make_dx_chest(),
    },
    {
        "PatientName": "Козлова^Елена^Дмитриевна",
        "PatientID": "004",
        "PatientSex": "F",
        "PatientBirthDate": "20010830",
        "StudyDescription": "УЗИ брюшной полости",
        "Modality": "US",
        "num_slices": 1,
        "generator": lambda *a: make_us_abdomen(),
    },
]


def main():
    print("=" * 60)
    print("Генератор синтетических DICOM-изображений")
    print("=" * 60)
    print()

    # Проверяем Orthanc
    try:
        resp = requests.get(f"{ORTHANC_URL}/system", timeout=3)
        if resp.status_code != 200:
            print(f"[ERR] Orthanc недоступен")
            return
        print(f"[OK] Orthanc: {resp.json().get('Name')} v{resp.json().get('Version')}")
    except requests.ConnectionError:
        print(f"[ERR] Orthanc не запущен. Запусти: cd orthanc && .\\Orthanc.exe orthanc.json")
        return

    total_instances = 0

    for pat in PATIENTS:
        print(f"\n{'=' * 60}")
        print(f"Пациент: {pat['PatientName']}  ({pat['PatientID']})")
        print(f"Исследование: {pat['StudyDescription']}  [{pat['Modality']}]")
        print(f"Срезов: {pat['num_slices']}")
        print(f"{'=' * 60}")

        study_uid = f"1.2.840.{make_uid()}"
        series_uid = f"1.2.840.{make_uid()}"
        size = 256 if pat["Modality"] in ("CT", "MR") else (512 if pat["Modality"] == "DX" else 400)

        for sl in range(pat["num_slices"]):
            instance_uid = f"1.2.840.{make_uid()}"

            # Генерируем изображение
            center = (pat["num_slices"] - 1) / 2
            offset = (sl - center) * 3
            pixel_array = pat["generator"](size, int(offset))

            ds = create_dicom_with_image(
                patient=pat,
                pixel_array=pixel_array,
                study_uid=study_uid,
                series_uid=series_uid,
                instance_uid=instance_uid,
                instance_number=sl + 1,
                series_description=f"{pat['StudyDescription']} (срез {sl+1}/{pat['num_slices']})",
            )

            result = upload_to_orthanc(ds)
            if result:
                total_instances += 1
                print(f"  [{sl+1}/{pat['num_slices']}] Загружен срез {sl+1} (ID: {result.get('ID', '?')[:12]}...)")
            else:
                print(f"  [{sl+1}/{pat['num_slices']}] [ERR] Ошибка")

        print(f"  StudyUID: {study_uid}")
        print(f"  DWV: http://localhost:8000/viewer/{study_uid}")

    print(f"\n{'=' * 60}")
    print(f"Итого загружено: {total_instances} DICOM-файлов")
    print(f"{'=' * 60}")
    print()
    print("Открой в браузере DWV Viewer:")
    print("  http://localhost:8000/viewer/<StudyUID>")


if __name__ == "__main__":
    main()
