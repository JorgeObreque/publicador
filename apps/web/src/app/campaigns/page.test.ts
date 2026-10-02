import { permanentRedirect } from 'next/navigation';
import CampaignsRedirectPage from './page';

jest.mock('next/navigation', () => ({
  permanentRedirect: jest.fn((url: string) => {
    // Replica el comportamiento de Next.js: `permanentRedirect` lanza
    // un error de tipo `NEXT_REDIRECT` para que el runtime aborte el
    // render. Lo replicamos aquí con `never` para no contaminar el
    // tipado del test.
    throw new Error(`NEXT_REDIRECT;push;/campaign-brief;308;${url}`);
  }),
  redirect: jest.fn(),
}));

const mockedPermanentRedirect = permanentRedirect as unknown as jest.Mock;

beforeEach(() => {
  mockedPermanentRedirect.mockClear();
});

describe('CampaignsRedirectPage', () => {
  it('llama a permanentRedirect apuntando a /campaign-brief', () => {
    expect(() => CampaignsRedirectPage()).toThrow(/NEXT_REDIRECT/);
    expect(mockedPermanentRedirect).toHaveBeenCalledTimes(1);
    expect(mockedPermanentRedirect).toHaveBeenCalledWith('/campaign-brief');
  });
});
