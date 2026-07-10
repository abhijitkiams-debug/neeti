"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf-worker/pdf.worker.min.mjs";

export function PdfViewer({ fileUrl }: { fileUrl: string }) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [width, setWidth] = useState(760);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-100 p-4">
      <div
        ref={(el) => {
          if (el) setWidth(Math.min(el.clientWidth, 900));
        }}
      >
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={<p className="py-8 text-center text-sm text-slate-500">Loading document…</p>}
          error={<p className="py-8 text-center text-sm text-red-600">Could not load PDF.</p>}
        >
          <div className="space-y-4">
            {Array.from({ length: numPages ?? 0 }, (_, i) => (
              <div key={i} className="overflow-hidden rounded-md bg-white shadow-sm">
                <Page pageNumber={i + 1} width={width} />
              </div>
            ))}
          </div>
        </Document>
      </div>
      <p className="mt-2 text-center text-xs text-slate-400">{numPages ? `${numPages} page(s)` : ""}</p>
    </div>
  );
}
