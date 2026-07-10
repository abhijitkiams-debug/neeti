import Papa from "papaparse";
import * as XLSX from "xlsx";
import { prisma } from "./prisma";

export type VendorUploadRow = {
  name: string;
  mobile: string;
  role?: string;
  geography?: string;
};

export type RowError = { row: number; reason: string };

function parseCsv(buffer: Buffer): Record<string, string>[] {
  const text = buffer.toString("utf-8");
  const { data } = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  return data;
}

function parseXlsx(buffer: Buffer): Record<string, string>[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
}

export async function bulkUploadVendorUsers(params: {
  tenantId: string;
  vendorOrgId: string;
  uploadedById: string;
  fileName: string;
  buffer: Buffer;
}) {
  const isXlsx = params.fileName.toLowerCase().endsWith(".xlsx");
  const rows = isXlsx ? parseXlsx(params.buffer) : parseCsv(params.buffer);

  const errors: RowError[] = [];
  let successCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const name = String(raw.name ?? raw.Name ?? "").trim();
    const mobile = String(raw.mobile ?? raw.Mobile ?? "").trim();
    const role = String(raw.role ?? raw.Role ?? "VENDOR_USER").trim().toUpperCase();
    const geography = String(raw.geography ?? raw.Geography ?? "").trim();

    const rowNum = i + 2; // account for header row, 1-indexed

    if (!name || !mobile) {
      errors.push({ row: rowNum, reason: "Missing required field: name and mobile are required" });
      continue;
    }
    if (!/^\+?[0-9]{6,15}$/.test(mobile)) {
      errors.push({ row: rowNum, reason: `Invalid mobile number: ${mobile}` });
      continue;
    }
    if (!["VENDOR_ADMIN", "VENDOR_USER"].includes(role)) {
      errors.push({ row: rowNum, reason: `Invalid role: ${role} (expected VENDOR_ADMIN or VENDOR_USER)` });
      continue;
    }

    try {
      await prisma.vendorUser.upsert({
        where: { tenantId_mobile: { tenantId: params.tenantId, mobile } },
        update: { name, role, geography: geography || null, vendorOrgId: params.vendorOrgId, status: "ACTIVE" },
        create: {
          tenantId: params.tenantId,
          vendorOrgId: params.vendorOrgId,
          name,
          mobile,
          role,
          geography: geography || null,
        },
      });
      successCount++;
    } catch (e) {
      errors.push({ row: rowNum, reason: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  const batch = await prisma.vendorUploadBatch.create({
    data: {
      vendorOrgId: params.vendorOrgId,
      fileName: params.fileName,
      uploadedById: params.uploadedById,
      totalRows: rows.length,
      successCount,
      errorCount: errors.length,
      errorLog: JSON.stringify(errors),
    },
  });

  return { batch, successCount, errors };
}
