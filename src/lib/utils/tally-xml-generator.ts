/**
 * Tally Prime XML Generator
 * ─────────────────────────
 * Converts cashbook transactions, transfers, and expenses into
 * Tally Prime-compatible XML using the IMPORTDATA envelope format.
 *
 * Voucher type mapping:
 *   cashbook_transactions txn_type='receipt'  → Receipt voucher
 *   cashbook_transactions txn_type='payment'  → Payment voucher
 *   cashbook_transfers                         → Contra voucher
 *
 * Tally XML sign convention (CRITICAL):
 *   ISDEEMEDPOSITIVE=Yes → Debit entry  → AMOUNT must be NEGATIVE  (e.g. -5000.00)
 *   ISDEEMEDPOSITIVE=No  → Credit entry → AMOUNT must be POSITIVE  (e.g. +5000.00)
 *   All amounts in a voucher MUST sum to zero.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface TallySettings {
  /** Exact company name as it appears in Tally Prime (case-sensitive) */
  company_name: string;
  /** Fallback ledger for receipt income when party_name is blank */
  default_income_ledger: string;
  /** Fallback ledger for payment expense when party_name is blank */
  default_expense_ledger: string;
  /** cashbook_id → Tally ledger name (e.g. "Cash", "HDFC Bank A/c") */
  cashbook_ledger_map: Record<string, string>;
  /** expense_category_id → Tally ledger name (e.g. "Office Expenses") */
  expense_category_ledger_map: Record<string, string>;
}

export interface TxnRow {
  id: string;
  txn_type: "receipt" | "payment";
  amount: number;
  cashbook_id: string;
  cashbook_name: string;
  narration: string;
  party_name: string | null;
  receipt_number: string;
  payment_mode: string;
  created_at: string;
  /** category_id present when reference_type='expense' */
  expense_category_id?: string | null;
  expense_category_name?: string | null;
}

export interface TransferRow {
  id: string;
  amount: number;
  from_cashbook_id: string;
  from_cashbook_name: string;
  to_cashbook_id: string;
  to_cashbook_name: string;
  description: string | null;
  transfer_date: string;
}

export interface GenerateXmlResult {
  xml: string;
  voucher_count: number;
  errors: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** XML-escape a string so it is safe to embed in element text / attributes */
function xmlEscape(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Format a date string or Date to Tally's YYYYMMDD format.
 * Uses UTC getters to avoid timezone-shift for servers running in non-IST zones.
 * For DATE strings (YYYY-MM-DD), slices directly without parsing to avoid any TZ shift.
 */
function tallyDate(date: string | Date): string {
  if (typeof date === "string") {
    // Plain date "YYYY-MM-DD" — slice directly, no parsing needed
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date.replace(/-/g, "");
    }
    // Timestamp — use UTC getters to avoid local-timezone shift
    const d = new Date(date);
    return (
      String(d.getUTCFullYear()) +
      String(d.getUTCMonth() + 1).padStart(2, "0") +
      String(d.getUTCDate()).padStart(2, "0")
    );
  }
  return (
    String(date.getUTCFullYear()) +
    String(date.getUTCMonth() + 1).padStart(2, "0") +
    String(date.getUTCDate()).padStart(2, "0")
  );
}

/** Format amount to 2 decimal places string */
function fmt(n: number): string {
  return Math.abs(n).toFixed(2);
}

// ── Ledger entry builder ───────────────────────────────────────────────────

function ledgerEntry({
  name,
  isDebit,
  amount,
  isPartyLedger = false,
  billRef,
}: {
  name: string;
  isDebit: boolean;
  amount: number;
  isPartyLedger?: boolean;
  billRef?: string;
}): string {
  const deemedPositive = isDebit ? "Yes" : "No";
  // Debit → negative amount; Credit → positive amount (Tally convention)
  const signedAmount = isDebit ? `-${fmt(amount)}` : `${fmt(amount)}`;
  const partyTag = isPartyLedger
    ? "\n            <ISPARTYLEDGER>Yes</ISPARTYLEDGER>\n            <ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>"
    : "";

  const billAlloc = billRef
    ? `\n            <BILLALLOCATIONS.LIST>\n              <NAME>${xmlEscape(billRef)}</NAME>\n              <BILLTYPE>On Acct</BILLTYPE>\n              <AMOUNT>${signedAmount}</AMOUNT>\n            </BILLALLOCATIONS.LIST>`
    : "";

  return `        <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${xmlEscape(name)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>${deemedPositive}</ISDEEMEDPOSITIVE>${partyTag}
            <AMOUNT>${signedAmount}</AMOUNT>${billAlloc}
        </ALLLEDGERENTRIES.LIST>`;
}

// ── Voucher builders ───────────────────────────────────────────────────────

function receiptVoucher(txn: TxnRow, cashbookLedger: string, partyLedger: string): string {
  // Receipt: money comes IN to cashbook
  //   Debit  the cashbook ledger (cash / bank)
  //   Credit the party / income ledger
  const date = tallyDate(txn.created_at);
  const narration = xmlEscape(
    txn.narration || `Receipt via ${txn.payment_mode} — ${txn.receipt_number}`
  );

  return `      <VOUCHER REMOTEID="${xmlEscape(txn.receipt_number)}" VCHTYPE="Receipt" ACTION="Create" OBJVIEW="Accounting Voucher View">
        <DATE>${date}</DATE>
        <EFFECTIVEDATE>${date}</EFFECTIVEDATE>
        <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
        <VOUCHERNUMBER>${xmlEscape(txn.receipt_number)}</VOUCHERNUMBER>
        <PARTYLEDGERNAME>${xmlEscape(cashbookLedger)}</PARTYLEDGERNAME>
        <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
        <NARRATION>${narration}</NARRATION>
${ledgerEntry({ name: cashbookLedger, isDebit: true,  amount: txn.amount })}
${ledgerEntry({ name: partyLedger,    isDebit: false, amount: txn.amount, isPartyLedger: true })}
      </VOUCHER>`;
}

function paymentVoucher(txn: TxnRow, cashbookLedger: string, partyLedger: string): string {
  // Payment: money goes OUT of cashbook
  //   Debit  the party / expense ledger
  //   Credit the cashbook ledger (cash / bank)
  const date = tallyDate(txn.created_at);
  const narration = xmlEscape(
    txn.narration || `Payment via ${txn.payment_mode} — ${txn.receipt_number}`
  );

  return `      <VOUCHER REMOTEID="${xmlEscape(txn.receipt_number)}" VCHTYPE="Payment" ACTION="Create" OBJVIEW="Accounting Voucher View">
        <DATE>${date}</DATE>
        <EFFECTIVEDATE>${date}</EFFECTIVEDATE>
        <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
        <VOUCHERNUMBER>${xmlEscape(txn.receipt_number)}</VOUCHERNUMBER>
        <PARTYLEDGERNAME>${xmlEscape(cashbookLedger)}</PARTYLEDGERNAME>
        <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
        <NARRATION>${narration}</NARRATION>
${ledgerEntry({ name: partyLedger,    isDebit: true,  amount: txn.amount, isPartyLedger: true })}
${ledgerEntry({ name: cashbookLedger, isDebit: false, amount: txn.amount })}
      </VOUCHER>`;
}

function contraVoucher(transfer: TransferRow, fromLedger: string, toLedger: string): string {
  // Contra: cash/bank to cash/bank transfer
  //   Debit  the destination (money arrives)
  //   Credit the source (money leaves)
  const date = tallyDate(transfer.transfer_date);
  const narration = xmlEscape(
    transfer.description ||
      `Transfer from ${transfer.from_cashbook_name} to ${transfer.to_cashbook_name}`
  );
  const vchNum = `CTR-${transfer.id.slice(0, 8).toUpperCase()}`;

  return `      <VOUCHER REMOTEID="CTR-${xmlEscape(transfer.id)}" VCHTYPE="Contra" ACTION="Create" OBJVIEW="Accounting Voucher View">
        <DATE>${date}</DATE>
        <EFFECTIVEDATE>${date}</EFFECTIVEDATE>
        <VOUCHERTYPENAME>Contra</VOUCHERTYPENAME>
        <VOUCHERNUMBER>${xmlEscape(vchNum)}</VOUCHERNUMBER>
        <PARTYLEDGERNAME>${xmlEscape(toLedger)}</PARTYLEDGERNAME>
        <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
        <NARRATION>${narration}</NARRATION>
${ledgerEntry({ name: toLedger,   isDebit: true,  amount: transfer.amount })}
${ledgerEntry({ name: fromLedger, isDebit: false, amount: transfer.amount })}
      </VOUCHER>`;
}

// ── Main export function ───────────────────────────────────────────────────

export function generateTallyXml(
  transactions: TxnRow[],
  transfers: TransferRow[],
  settings: TallySettings
): GenerateXmlResult {
  const errors: string[] = [];
  const voucherBlocks: string[] = [];

  // ── Map transactions → vouchers ──────────────────────────────
  for (const txn of transactions) {
    // Resolve cashbook ledger name
    const cashbookLedger =
      settings.cashbook_ledger_map[txn.cashbook_id] || txn.cashbook_name;

    if (!settings.cashbook_ledger_map[txn.cashbook_id]) {
      errors.push(
        `No Tally ledger mapped for cashbook "${txn.cashbook_name}". Using cashbook name as fallback — verify this matches your Tally ledger.`
      );
    }

    // Resolve party / income / expense ledger name
    let partyLedger: string;
    if (txn.txn_type === "receipt") {
      // For receipts, credit goes to: party_name (if set) else default income ledger
      partyLedger =
        txn.party_name?.trim() || settings.default_income_ledger;
    } else {
      // For payments, debit goes to: party_name (if set), or category ledger, or default expense
      if (txn.party_name?.trim()) {
        partyLedger = txn.party_name.trim();
      } else if (
        txn.expense_category_id &&
        settings.expense_category_ledger_map[txn.expense_category_id]
      ) {
        partyLedger = settings.expense_category_ledger_map[txn.expense_category_id];
      } else if (txn.expense_category_name?.trim()) {
        partyLedger = txn.expense_category_name.trim();
      } else {
        partyLedger = settings.default_expense_ledger;
      }
    }

    if (!partyLedger) {
      errors.push(`Receipt ${txn.receipt_number}: could not resolve party/income ledger — skipped.`);
      continue;
    }

    const block =
      txn.txn_type === "receipt"
        ? receiptVoucher(txn, cashbookLedger, partyLedger)
        : paymentVoucher(txn, cashbookLedger, partyLedger);

    voucherBlocks.push(block);
  }

  // ── Map transfers → Contra vouchers ─────────────────────────
  for (const transfer of transfers) {
    const fromLedger =
      settings.cashbook_ledger_map[transfer.from_cashbook_id] ||
      transfer.from_cashbook_name;
    const toLedger =
      settings.cashbook_ledger_map[transfer.to_cashbook_id] ||
      transfer.to_cashbook_name;

    if (!settings.cashbook_ledger_map[transfer.from_cashbook_id]) {
      errors.push(
        `No Tally ledger mapped for cashbook "${transfer.from_cashbook_name}". Using cashbook name as fallback.`
      );
    }
    if (!settings.cashbook_ledger_map[transfer.to_cashbook_id]) {
      errors.push(
        `No Tally ledger mapped for cashbook "${transfer.to_cashbook_name}". Using cashbook name as fallback.`
      );
    }

    voucherBlocks.push(contraVoucher(transfer, fromLedger, toLedger));
  }

  // ── Wrap in IMPORTDATA envelope ──────────────────────────────
  const companyName = xmlEscape(settings.company_name);
  const vouchersXml = voucherBlocks.join("\n\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  Tally Prime XML Export
  Generated by Prk.sh on ${new Date().toISOString()}
  Company: ${settings.company_name}
  Vouchers: ${voucherBlocks.length}

  Import instructions:
  1. Open Tally Prime and open the company: "${settings.company_name}"
  2. Go to: Gateway of Tally → Import Data → Vouchers
  3. Select this XML file
  4. Verify the import result (Created / Errors count)
-->
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
          <IMPORTDUPS>@@DUPCOMBINE</IMPORTDUPS>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">

${vouchersXml}

        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  return {
    xml,
    voucher_count: voucherBlocks.length,
    errors,
  };
}

// ── Default settings factory ───────────────────────────────────────────────

export function defaultTallySettings(): TallySettings {
  return {
    company_name: "",
    default_income_ledger: "Sales",
    default_expense_ledger: "Indirect Expenses",
    cashbook_ledger_map: {},
    expense_category_ledger_map: {},
  };
}
