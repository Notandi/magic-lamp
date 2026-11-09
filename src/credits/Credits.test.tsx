import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Credits, CreditsPanel } from './Credits';

// Wording copied verbatim from https://company.wizards.com/en/legal/fancontentpolicy (checked 2026-11-09).
const FAN_CONTENT_DISCLAIMER =
  'Magic Lamp is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.';

function text(html: string) {
  return html.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
}

describe('Credits', () => {
  it('starts closed, showing only the ⓘ button', () => {
    const html = renderToStaticMarkup(<Credits />);
    expect(html).toContain('ⓘ');
    expect(html).toContain('aria-expanded="false"');
    expect(text(html)).not.toContain('Fan Content Policy');
  });
});

describe('CreditsPanel', () => {
  const html = renderToStaticMarkup(<CreditsPanel onClose={() => {}} />);

  it('shows the exact Fan Content Policy disclaimer', () => {
    expect(text(html)).toContain(FAN_CONTENT_DISCLAIMER);
  });

  it('credits Scryfall as the card data and image source', () => {
    expect(text(html)).toMatch(/Card data and images.*Scryfall/);
    expect(html).toContain('href="https://scryfall.com"');
  });

  it('credits the WebXR Input Profiles hand model under MIT', () => {
    expect(text(html)).toContain('WebXR Input Profiles');
    expect(text(html)).toContain('MIT License');
    expect(text(html)).toContain('Copyright (c) 2019 Amazon');
  });

  it('has a close button', () => {
    expect(html).toMatch(/<button[^>]*aria-label="Close credits"/);
  });
});
