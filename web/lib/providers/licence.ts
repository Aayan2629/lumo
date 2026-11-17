import 'server-only';
import { env } from '../env';

// Checks an agent or agency licence against NSW Fair Trading's public licence register.
// Live: the NSW Government "Property Licence" API on api.nsw.gov.au (needs an API key).
export type LicenceResult = { valid: boolean; status: 'current' | 'expired' | 'cancelled' | 'not_found'; holder?: string };
export interface LicenceProvider { check(licenceNo: string): Promise<LicenceResult>; }

// Pilot register. Any 6 to 10 digit number not listed below counts as current, so testers can
// sign up; the listed ones show the failure paths.
const MOCK_REGISTER: Record<string, LicenceResult> = {
  '000000': { valid: false, status: 'not_found' },
  '111111': { valid: false, status: 'expired', holder: 'Expired Realty Pty Ltd' },
  '222222': { valid: false, status: 'cancelled', holder: 'Cancelled Agency' },
};

export function licenceProvider(): LicenceProvider {
  if (env.provider('LICENCE') === 'mock') {
    if (!env.allowMocks) throw new Error('Mock licence register is disabled');
    return {
      async check(no) {
        const n = no.replace(/\s/g, '');
        if (!/^\d{6,10}$/.test(n)) return { valid: false, status: 'not_found' };
        return MOCK_REGISTER[n] ?? { valid: true, status: 'current', holder: 'Pilot licence holder' };
      },
    };
  }
  return { async check() { throw new Error('NSW licence API adapter not wired yet (lib/providers/licence.ts)'); } };
}
