import type { ReactNode } from "react";
import { buildQuotationDocument, buildQuotationHeader, COMPANY_ADDRESS, COMPANY_NAME, DOCUMENT_TITLE, INTRO_TEXT, KMD_LOGO_URL } from "@/lib/digital/document";
import type { Quotation } from "@/lib/digital/types";

/**
 * The quotation as the client receives it.
 *
 * This is the on-screen preview, the printed copy and the visual reference for
 * the Word and PDF downloads, all rendered from the saved quotation so they can
 * never disagree with one another.
 */
export function QuotationPreview({ quotation }: { quotation: Quotation }) {
  const document = buildQuotationDocument(quotation);
  const header = buildQuotationHeader(quotation);
  const included = document.fees.filter((fee) => fee.includedInTotal);
  const separate = document.fees.filter(
    (fee) => !fee.includedInTotal && !(fee.percent && fee.percent > 0) && !fee.description.toLowerCase().includes("co-partner"),
  );
  const percentage = document.fees.filter((fee) => fee.percent && fee.percent > 0);

  return (
    <article id="quotation-print-area" className="mx-auto w-full max-w-3xl bg-card p-8 text-[13px] leading-relaxed text-foreground">
      <header className="flex flex-col items-center gap-1 border-b pb-4 text-center">
        <img src={KMD_LOGO_URL} alt="" crossOrigin="anonymous" className="h-20 w-20 object-contain" />
        <p className="mt-1 text-sm font-bold tracking-wide">{COMPANY_NAME}</p>
        <p className="text-[11px] text-muted-foreground">{COMPANY_ADDRESS}</p>
        <h1 className="mt-3 text-lg font-bold tracking-tight">{DOCUMENT_TITLE}</h1>
        <p className="text-[11px] text-muted-foreground">
          Quotation no. <span className="font-mono">{header.quotationNumber}</span> · Date: {header.dateText}
          {header.validUntilText ? ` · Valid until: ${header.validUntilText}` : ""}
          {header.targetCompletionText ? ` · Target completion: ${header.targetCompletionText}` : ""}
        </p>
      </header>

      <p className="mt-4 text-[12px] text-muted-foreground">{INTRO_TEXT}</p>

      <Section title="Client details">
        <dl className="grid gap-1">
          {document.fields.map((field) => (
            <div key={field.label} className="flex gap-2">
              <dt className="shrink-0 font-medium">{field.label}:</dt>
              <dd className="min-w-0 flex-1 border-b border-dotted">
                {field.value.length > 0 ? field.value : "\u00A0"}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Services Requested">
        <p className="text-[11px] text-muted-foreground">Select all that apply.</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {document.checklist.map((option) => (
            <li key={option.label} className="flex items-center gap-2">
              <span aria-hidden className="font-mono text-sm">
                {option.ticked ? "\u2612" : "\u2610"}
              </span>
              <span>{option.label}</span>
            </li>
          ))}
          <li className="flex items-center gap-2 sm:col-span-2">
            <span aria-hidden className="font-mono text-sm">
              {"\u2610"}
            </span>
            <span>Other</span>
            <span className="min-w-0 flex-1 border-b border-dotted">{document.otherServices ?? ""}</span>
          </li>
        </ul>
      </Section>

      <Section title="Business and project requirements">
        <dl className="grid gap-2">
          {document.requirementFields.map((field) => (
            <div key={field.label}>
              <dt className="font-medium">{field.label}</dt>
              <dd className="mt-0.5 whitespace-pre-wrap border-b border-dotted text-[12px]">
                {field.value.length > 0 ? field.value : "\u00A0"}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Pricing and Acceptance — Project quotation">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-muted/60 text-left">
              <th className="border px-2 py-1 font-semibold">Service or deliverable</th>
              <th className="w-14 border px-2 py-1 text-center font-semibold">Qty</th>
              <th className="w-28 border px-2 py-1 text-right font-semibold">Amount PHP</th>
            </tr>
          </thead>
          <tbody>
            {document.lines.map((line, index) => (
              <tr key={`item-${index}`}>
                <td className="border px-2 py-1.5 align-top">{line.description}</td>
                <td className="border px-2 py-1.5 text-center align-top">{line.qty}</td>
                <td className="border px-2 py-1.5 text-right align-top tabular-nums">{line.amount}</td>
              </tr>
            ))}
            {document.additionalLines.map((line, index) => (
              <tr key={`extra-${index}`}>
                <td className="border px-2 py-1.5 align-top">Additional agreed work — {line.description}</td>
                <td className="border px-2 py-1.5 text-center align-top">{line.qty}</td>
                <td className="border px-2 py-1.5 text-right align-top tabular-nums">{line.amount}</td>
              </tr>
            ))}
            <SummaryRow label="Subtotal" value={document.subtotal} />
            <SummaryRow label="Discount if applicable" value={document.discount} />
            <SummaryRow label="Applicable taxes if any" value={document.tax} />
            {quotation.includedFeesTotal > 0 ? (
              <SummaryRow
                label="Recurring charges included in the contract price"
                value={document.includedFeesTotal}
              />
            ) : null}
            <SummaryRow label="TOTAL CONTRACT PRICE" value={document.total} emphasis />
          </tbody>
        </table>

        <p className="mt-2 text-[11px] text-muted-foreground">
          Recurring domain, hosting and maintenance charges are either included in the total contract price,
          as flagged below, or billed separately. They are never counted twice.
        </p>
      </Section>

      <Section title="Optional maintenance and hosting">
        <ul className="grid gap-1 text-[12px]">
          {included.map((fee) => (
            <li key={`in-${fee.description}`}>
              <strong>Included in the contract price — {fee.description}:</strong> {fee.detail}
            </li>
          ))}
          {separate.map((fee) => (
            <li key={`sep-${fee.description}`}>
              <strong>Billed separately — {fee.description}:</strong> {fee.detail}
            </li>
          ))}
          {percentage.map((fee) => (
            <li key={`pct-${fee.description}`}>
              <strong>{fee.description}:</strong> {fee.detail}, shown separately and not part of the total
              contract price.
            </li>
          ))}
          {included.length === 0 && separate.length === 0 && percentage.length === 0 ? (
            <li className="text-muted-foreground">No recurring charge is recorded on this quotation.</li>
          ) : null}
        </ul>

        <p className="mt-2 text-[11px] text-muted-foreground">
          Billed separately: {document.separateFeesTotal} · per year: {document.separateAnnualTotal} · per month:{" "}
          {document.separateMonthlyTotal}
        </p>

        {document.maintenanceLines.map((line) => (
          <p key={line} className="mt-2 text-[12px]">
            {line}
          </p>
        ))}

        <p className="mt-2 text-[11px] text-muted-foreground">
          Recurring fees are separate unless expressly included above. Record the selected provider, account
          ownership, and renewal arrangements before project handover.
        </p>
      </Section>

      <Section title="Payment and project terms">
        {document.paymentLines.map((line) => (
          <p key={line} className="mt-1 text-[12px]">
            {line}
          </p>
        ))}
        {document.termsText ? <p className="mt-2 text-[11px] text-muted-foreground">{document.termsText}</p> : null}
      </Section>

      <Section title="Acceptance">
        <p className="text-[12px]">
          By signing, both parties confirm the scope, total contract price, selected options, and payment terms
          recorded in this quotation.
        </p>
        <div className="mt-4 grid gap-3 text-[12px]">
          <p>
            Prepared by: <strong>{document.preparedBy}</strong>
            <span className="ml-6 inline-block min-w-[12rem] border-b border-dotted">Signature</span>
          </p>
          <p>
            Client name <span className="ml-2 inline-block min-w-[9rem] border-b border-dotted">&nbsp;</span>
            <span className="ml-4 inline-block min-w-[12rem] border-b border-dotted">Signature</span>
          </p>
          <p>
            Date <span className="ml-2 inline-block min-w-[12rem] border-b border-dotted">&nbsp;</span>
          </p>
        </div>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 border-b pb-1 text-[13px] font-bold uppercase tracking-wide">{title}</h2>
      {children}
    </section>
  );
}

function SummaryRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <tr className={emphasis ? "bg-muted/60 font-bold" : undefined}>
      <td className="border px-2 py-1.5 text-right" colSpan={2}>
        {label}
      </td>
      <td className="border px-2 py-1.5 text-right tabular-nums">{value}</td>
    </tr>
  );
}
