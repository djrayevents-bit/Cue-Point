/** Invoice ↔ event linking and paid totals — shared by App + CUE (Day 4 SoT). */

export const invoiceLinksToEvent = (i, ev) => {
  if (!i || !ev) return false;
  if (i.eventId != null && i.eventId !== "" && String(i.eventId) === String(ev.id)) return true;
  if (i.eventId != null && i.eventId !== "") return false;
  const nameMatch = (i.event && ev.name && i.event === ev.name)
    || (i.eventName && ev.name && i.eventName === ev.name);
  const clientMatch = !!(i.client && ev.client && i.client === ev.client);
  return !!(nameMatch && clientMatch);
};

export const invoicePaidAmount = (inv) => {
  const dep = Number(inv?.depositPaid) || 0;
  const bal = Number(inv?.balancePaid) || 0;
  if (dep || bal) return dep + bal;
  return Number(inv?.paid) || 0;
};

/** Paid totals for an event — invoices (by eventId) are source of truth when present. */
export const eventPaidTotals = (ev, invoices) => {
  const linked = (invoices || []).filter(i => invoiceLinksToEvent(i, ev));
  if (linked.length > 0) {
    const depositPaid = linked.reduce((s, i) => s + (Number(i.depositPaid) || 0), 0);
    const balancePaid = linked.reduce((s, i) => s + (Number(i.balancePaid) || 0), 0);
    const latestDep = linked.find(i => i.depositPaidDate) || linked[0];
    const latestBal = linked.find(i => i.balancePaidDate) || linked[0];
    return {
      depositPaid,
      balancePaid,
      totalPaid: depositPaid + balancePaid,
      depositPaidDate: latestDep?.depositPaidDate || null,
      balancePaidDate: latestBal?.balancePaidDate || null,
      depositPayMethod: latestDep?.depositPayMethod || null,
      balancePayMethod: latestBal?.balancePayMethod || null,
      fromInvoices: true,
      invoices: linked,
    };
  }
  const depositPaid = Number(ev?.depositPaid) || 0;
  const balancePaid = Number(ev?.balancePaid) || 0;
  return {
    depositPaid,
    balancePaid,
    totalPaid: depositPaid + balancePaid,
    depositPaidDate: ev?.depositPaidDate || null,
    balancePaidDate: ev?.balancePaidDate || null,
    depositPayMethod: ev?.depositPayMethod || null,
    balancePayMethod: ev?.balancePayMethod || null,
    fromInvoices: false,
    invoices: [],
  };
};

/** Authoritative financial snapshot for CUE / API context (`_computed`). */
export const buildEventFinancialComputed = (ev, invoices) => {
  const total_fee = Number(ev?.totalFee) || 0;
  const depositAmt = Number(ev?.depositAmount) || 0;
  const totals = eventPaidTotals(ev, invoices);
  const amount_paid = totals.totalPaid;
  const balance_remaining = Math.max(0, total_fee - amount_paid);
  let deposit_status = "Pending";
  if (depositAmt > 0) {
    if (totals.depositPaid >= depositAmt) deposit_status = "Paid";
    else if (totals.depositPaid > 0) deposit_status = "Partial";
  } else if (totals.depositPaid > 0) {
    deposit_status = "Paid";
  }
  return {
    total_fee,
    amount_paid,
    balance_remaining,
    deposit_status,
    deposit_paid: totals.depositPaid,
    balance_paid: totals.balancePaid,
    from_invoices: totals.fromInvoices,
  };
};
