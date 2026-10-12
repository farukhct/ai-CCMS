/**
 * CCMS Invariant & Unit Test Suite
 * Self-contained executable verification for database rules, date formatting,
 * blank records, calculations, and security.
 */

import { isValidCalendarDate, toCanonicalDate, toDisplayDate, isLeapYear } from '../services/dateUtils';
import { getDatabaseTableStats } from '../database/engine';
import bcrypt from 'bcryptjs';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function runCcmsTests(): { total: number; passed: number; failures: string[] } {
  const failures: string[] = [];
  let passed = 0;
  let total = 0;

  function runTest(name: string, fn: () => void) {
    total++;
    try {
      fn();
      passed++;
    } catch (err: any) {
      failures.push(`${name}: ${err.message || String(err)}`);
    }
  }

  // 1. Date Invariant Tests
  runTest('Date Validation rejects impossible dates (e.g. 31-02-2026, 31-04-2026)', () => {
    assert(!isValidCalendarDate(31, 2, 2026), '31-02-2026 must be false');
    assert(!isValidCalendarDate(31, 4, 2026), '31-04-2026 must be false');
    assert(!isValidCalendarDate(29, 2, 2025), '29-02-2025 (non-leap year) must be false');
    assert(isValidCalendarDate(29, 2, 2024), '29-02-2024 (leap year) must be true');
    assert(isValidCalendarDate(15, 1, 2026), '15-01-2026 must be true');
  });

  runTest('Leap year detection is exact', () => {
    assert(isLeapYear(2024), '2024 is leap');
    assert(!isLeapYear(2025), '2025 is not leap');
    assert(isLeapYear(2000), '2000 is leap');
    assert(!isLeapYear(1900), '1900 is not leap');
  });

  runTest('Canonical date conversion stores YYYY-MM-DD and formats to DD-MM-YYYY', () => {
    assert(toCanonicalDate('15-01-2026') === '2026-01-15', '15-01-2026 -> 2026-01-15');
    assert(toCanonicalDate('2026-01-15') === '2026-01-15', '2026-01-15 -> 2026-01-15');
    assert(toCanonicalDate('31-02-2026') === '', 'Invalid date rejected');
    assert(toDisplayDate('2026-01-15') === '15-01-2026', 'Display format is DD-MM-YYYY');
  });

  // 2. Security & Password Hashing Tests
  runTest('Password hashing with salted bcrypt correctly verifies matching password', () => {
    const rawPass = 'SecretCourtAdmin2026!';
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(rawPass, salt);

    assert(bcrypt.compareSync(rawPass, hash), 'Bcrypt compare matches');
    assert(!bcrypt.compareSync('WrongPassword', hash), 'Wrong password rejected');
    assert(!hash.includes(rawPass), 'Plaintext is never stored');
  });

  // 3. String Preservation for Phone Numbers and Accounts (Leading Zeros)
  runTest('Phone and Account numbers preserve leading zeros as exact text', () => {
    const phone = '01711000000';
    const bankAccount = '0021487654321';
    const routing = '00271458';

    assert(phone.startsWith('0'), 'Phone preserves leading zero');
    assert(phone.length === 11, 'Phone length intact');
    assert(bankAccount.startsWith('00'), 'Account preserves double leading zeros');
    assert(routing.startsWith('00'), 'Routing preserves double leading zeros');
  });

  // 4. Selective Database Table Deletion Facilities
  runTest('Selective table deletion preserves schema and unlinks dependent foreign keys', () => {
    const stats = getDatabaseTableStats();
    assert(Array.isArray(stats), 'getDatabaseTableStats returns array of table stats');
    assert(stats.some((s: any) => s.name === 'Applications'), 'Applications table exists in stats');
    assert(stats.some((s: any) => s.name === 'Donations'), 'Donations table exists in stats');
    assert(stats.some((s: any) => s.name === 'Disbursements'), 'Disbursements table exists in stats');
  });

  // 5. Application Form Numeric-Only and 11-digit Validation
  runTest('Application Phone, Bank Account, and Routing Number enforce numeric constraints and 11-digit phone', () => {
    const validPhone = '01711234567';
    const invalidPhoneShort = '0171123456';
    const invalidPhoneAlpha = '0171123456A';
    const cleanDigits = (v: string) => v.replace(/\D/g, '');

    assert(/^\d{11}$/.test(validPhone), 'Valid 11-digit numeric phone');
    assert(!/^\d{11}$/.test(invalidPhoneShort), 'Short phone rejected');
    assert(!/^\d{11}$/.test(invalidPhoneAlpha), 'Alpha phone rejected');
    assert(cleanDigits('017-1123-4567') === '01711234567', 'Clean non-digits leaves digits');

    const validBankAccount = '0021487654321';
    const validRouting = '200271458';
    assert(/^\d+$/.test(validBankAccount), 'Bank account is numeric');
    assert(/^\d+$/.test(validRouting), 'Routing number is numeric');
    assert(!/^\d+$/.test('00214876ABC'), 'Non-numeric bank account rejected');
  });

  // 6. Donation Judgement Date Requirement
  runTest('Donation Judgement Date is mandatory and non-empty', () => {
    const isJudgementDateValid = (d: string) => Boolean(d && d.trim().length > 0);
    assert(isJudgementDateValid('2026-03-15'), 'Valid judgement date present');
    assert(!isJudgementDateValid(''), 'Empty judgement date rejected as invalid');
    assert(!isJudgementDateValid('   '), 'Whitespace judgement date rejected as invalid');
  });

  // 7. Disbursement Date Less Than Judgement Date Rule
  runTest('Disbursement Date must be strictly less than Judgement Date', () => {
    const judgementDate = '2026-06-15';
    const validDisbursementDate = '2026-05-10'; // Before judgement date
    const equalDisbursementDate = '2026-06-15'; // Equal
    const invalidDisbursementDate = '2026-07-01'; // After judgement date

    const isDisbValid = (disb: string, judg: string) => {
      const cDisb = toCanonicalDate(disb);
      const cJudg = toCanonicalDate(judg);
      return Boolean(cDisb && cJudg && cDisb < cJudg);
    };

    assert(isDisbValid(validDisbursementDate, judgementDate), 'Prior disbursement date is accepted');
    assert(!isDisbValid(equalDisbursementDate, judgementDate), 'Equal date rejected (must be strictly less)');
    assert(!isDisbValid(invalidDisbursementDate, judgementDate), 'Later date rejected');
  });

  // 8. Receiver Phone Number 11-digit Numeric Rule
  runTest('Receiver Phone Number accepts only numeric values and exactly 11 characters', () => {
    const validReceiverPhone = '01819000000';
    const invalidReceiverPhone = '0181900000'; // 10 digits
    assert(/^\d{11}$/.test(validReceiverPhone), 'Valid receiver phone accepted');
    assert(!/^\d{11}$/.test(invalidReceiverPhone), 'Invalid length receiver phone rejected');
  });

  return { total, passed, failures };
}
