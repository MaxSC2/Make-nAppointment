import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const DIR = "screenshots";

const pages = [
  // Patient
  { url: "/", name: "01-landing" },
  { url: "/login", name: "02-login" },
  { url: "/dashboard", name: "03-patient-dashboard", role: "patient" },
  { url: "/appointment", name: "04-patient-appointment", role: "patient" },
  { url: "/emk", name: "05-patient-emk", role: "patient" },
  { url: "/emk/visits", name: "06-patient-emk-visits", role: "patient" },
  { url: "/emk/prescriptions", name: "07-patient-emk-prescriptions", role: "patient" },
  { url: "/laboratory", name: "08-patient-laboratory", role: "patient" },
  // Doctor
  { url: "/doctor/dashboard", name: "09-doctor-dashboard", role: "doctor" },
  { url: "/doctor/patients", name: "10-doctor-patients", role: "doctor" },
  { url: "/doctor/schedule", name: "11-doctor-schedule", role: "doctor" },
  { url: "/doctor/appointments", name: "12-doctor-appointments", role: "doctor" },
  // Admin
  { url: "/admin/dashboard", name: "13-admin-dashboard", role: "admin" },
  { url: "/admin/users", name: "14-admin-users", role: "admin" },
  { url: "/admin/doctors", name: "15-admin-doctors", role: "admin" },
  { url: "/admin/clinics", name: "16-admin-clinics", role: "admin" },
  { url: "/admin/audit", name: "17-admin-audit", role: "admin" },
];

const browser = await chromium.launch({
  executablePath: "C:\\Users\\Пользователь\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe"
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

for (const p of pages) {
  if (p.role) {
    await context.addCookies([
      { name: "auth_token", value: "mock-token-123", domain: "localhost", path: "/" },
      { name: "role", value: p.role, domain: "localhost", path: "/" },
    ]);
  }
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}${p.url}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${DIR}/${p.name}.png`, fullPage: true });
    console.log(`✓ ${p.name} (${p.role || "guest"})`);
  } catch (err) {
    console.error(`✗ ${p.name}: ${err.message}`);
  }
  await page.close();
}

await browser.close();
console.log("Done");
