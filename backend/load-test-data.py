"""
Скрипт для загрузки тестовых DICOM-данных в Orthanc.

Что делает:
1. Создаёт несколько учебных DICOM-файлов с разными пациентами
2. Загружает их в Orthanc через REST API
3. Выводит StudyInstanceUID для каждого, чтобы можно было открыть в DWV

Запуск:
    python load-test-data.py

Зависимости:
    pip install requests pydicom
"""

import uuid
import json
import requests
import pydicom
import io
from pydicom.dataset import Dataset, FileMetaDataset
from datetime import datetime

ORTHANC_URL = "http://localhost:8042"

# Тестовые пациенты
test_patients = [
    {
        "PatientName": "Иванов^Иван^Иванович",
        "PatientID": "001",
        "PatientSex": "M",
        "PatientBirthDate": "19800515",
        "StudyDescription": "КТ грудной клетки",
        "Modality": "CT",
    },
    {
        "PatientName": "Петрова^Анна^Сергеевна",
        "PatientID": "002",
        "PatientSex": "F",
        "PatientBirthDate": "19920320",
        "StudyDescription": "МРТ головного мозга",
        "Modality": "MR",
    },
    {
        "PatientName": "Сидоров^Пётр^Алексеевич",
        "PatientID": "003",
        "PatientSex": "M",
        "PatientBirthDate": "19671102",
        "StudyDescription": "Рентгенография грудной клетки",
        "Modality": "DX",
    },
    {
        "PatientName": "Козлова^Елена^Дмитриевна",
        "PatientID": "004",
        "PatientSex": "F",
        "PatientBirthDate": "20010830",
        "StudyDescription": "УЗИ брюшной полости",
        "Modality": "US",
    },
]


def create_minimal_dicom(patient: dict) -> bytes:
    """
    Создаёт минимальный DICOM-файл с метаданными пациента.
    Это НЕ настоящий снимок, а только его "обёртка" с данными.
    Для учебных целей этого достаточно, чтобы Orthanc увидел пациента.
    """
    # Генерируем UID (только цифры и точки, без дефисов)
    def make_uid(): return str(uuid.uuid4().int)[:15]
    study_uid = f"1.2.840.{make_uid()}"
    series_uid = f"1.2.840.{make_uid()}"
    instance_uid = f"1.2.840.{make_uid()}"

    # DICOM File Meta Information (обязательно для корректного DICOM-файла)
    file_meta = FileMetaDataset()
    file_meta.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.1.1.2"  # CT Image Storage
    file_meta.MediaStorageSOPInstanceUID = instance_uid
    file_meta.ImplementationClassUID = f"1.2.840.{make_uid()}"
    file_meta.ImplementationVersionName = "PYTHON_DICOM"

    # Основные DICOM-теги
    ds = Dataset()
    ds.file_meta = file_meta

    # Patient module
    ds.PatientName = patient["PatientName"]
    ds.PatientID = patient["PatientID"]
    ds.PatientSex = patient["PatientSex"]
    ds.PatientBirthDate = patient["PatientBirthDate"]

    # Study module
    ds.StudyDate = datetime.now().strftime("%Y%m%d")
    ds.StudyTime = datetime.now().strftime("%H%M%S")
    ds.StudyDescription = patient["StudyDescription"]
    ds.StudyInstanceUID = study_uid
    ds.AccessionNumber = str(uuid.uuid4())[:8].upper()

    # Series module
    ds.SeriesDate = ds.StudyDate
    ds.SeriesDescription = patient["StudyDescription"]
    ds.SeriesInstanceUID = series_uid
    ds.SeriesNumber = "1"
    ds.Modality = patient["Modality"]
    ds.ProtocolName = patient["StudyDescription"]

    # Equipment module
    ds.Manufacturer = "Учебный стенд"
    ds.ManufacturerModelName = "PACS-RIS-Queue Demo"
    ds.DeviceSerialNumber = "DEMO-001"

    # Image module (минимальные обязательные теги)
    ds.SOPClassUID = file_meta.MediaStorageSOPClassUID
    ds.SOPInstanceUID = instance_uid
    ds.InstanceNumber = "1"

    # Pixel data (минимальный — 1x1 пиксель, чтобы файл был валидным DICOM)
    ds.PixelData = b"\x00"
    ds.Rows = 1
    ds.Columns = 1
    ds.BitsAllocated = 16
    ds.BitsStored = 16
    ds.HighBit = 15
    ds.PixelRepresentation = 0
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = "MONOCHROME2"

    # Сохраняем в память
    ds.is_implicit_VR = False
    ds.is_little_endian = True

    return ds


def upload_to_orthanc(ds: Dataset) -> dict:
    """
    Загружает DICOM-файл в Orthanc через REST API.
    POST /instances — принимает raw DICOM-файл в теле запроса.
    """
    # Сохраняем в память и загружаем
    buf = io.BytesIO()
    ds.save_as(buf)
    dicom_bytes = buf.getvalue()
    resp = requests.post(
        f"{ORTHANC_URL}/instances",
        data=dicom_bytes,
        headers={"Content-Type": "application/dicom"}
    )
    if resp.status_code == 200:
        return resp.json()
    else:
        print(f"  Ошибка {resp.status_code}: {resp.text}")
        return None


def main():
    print("=" * 60)
    print("Загрузка тестовых DICOM-данных в Orthanc")
    print("=" * 60)
    print()

    # Проверяем, доступен ли Orthanc
    try:
        resp = requests.get(f"{ORTHANC_URL}/system", timeout=3)
        if resp.status_code != 200:
            print(f"[ERR] Orthanc недоступен по адресу {ORTHANC_URL}")
            print(f"   Ответ: {resp.status_code}")
            print("   Запусти Orthanc перед запуском этого скрипта.")
            return
        print(f"[OK] Orthanc доступен: {resp.json().get('Name', 'Orthanc')}")
    except requests.ConnectionError:
        print(f"[ERR] Не удалось подключиться к Orthanc по адресу {ORTHANC_URL}")
        print("   Запусти Orthanc: cd orthanc && .\\Orthanc.exe orthanc.json")
        return

    print()

    # Загружаем каждого пациента
    for i, patient in enumerate(test_patients):
        print(f"--- Пациент {i+1}: {patient['PatientName']} ---")

        ds = create_minimal_dicom(patient)
        result = upload_to_orthanc(ds)

        if result:
            study_uid = ds.StudyInstanceUID
            print(f"  [OK] Загружено!")
            print(f"     Orthanc ID: {result.get('ID')}")
            print(f"     StudyUID:   {study_uid}")
            print(f"     DWV:        http://localhost:8000/viewer/{study_uid}")
        else:
            print(f"  [ERR] Ошибка загрузки")

        print()

    # Итог
    print("=" * 60)
    print("Сводка:")
    resp = requests.get(f"{ORTHANC_URL}/patients")
    patients = resp.json()
    print(f"  Пациентов в Orthanc: {len(patients)}")

    resp = requests.get(f"{ORTHANC_URL}/studies")
    studies = resp.json()
    print(f"  Исследований: {len(studies)}")

    resp = requests.get(f"{ORTHANC_URL}/instances")
    instances = resp.json()
    print(f"  DICOM-файлов: {len(instances)}")

    print()
    print("Открой в браузере:")
    print(f"  Orthanc Explorer: http://localhost:8042")
    print(f"  DWV Viewer:       http://localhost:8000/viewer/<StudyUID>")
    print("=" * 60)


if __name__ == "__main__":
    main()
