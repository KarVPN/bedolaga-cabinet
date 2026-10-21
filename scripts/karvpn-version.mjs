import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Keep the adopted upstream release fixed; increment only KarVPN's revision. */
export function nextKarvpnVersion(upstream, lastReleased) {
  if (!/^\d+\.\d+\.\d+$/.test(upstream)) throw new Error('Invalid upstream version');
  const previous = /^(\d+\.\d+\.\d+)(?:-karvpn\.([1-9]\d*))?$/.exec(lastReleased);
  if (!previous) throw new Error('Invalid previous KarVPN version');
  const base = upstream.split('.').map(BigInt);
  const old = previous[1].split('.').map(BigInt);
  const different = base.findIndex((part, index) => part !== old[index]);
  if (different !== -1 && base[different] < old[different]) {
    throw new Error('Refusing to downgrade the upstream version');
  }
  const revision = different === -1 && previous[2] ? BigInt(previous[2]) + 1n : 1n;
  return `${upstream}-karvpn.${revision}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const load = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'));
  const { upstream } = load('karvpn-version.json');
  const { version } = load('package.json');
  if (
    version !== upstream &&
    !new RegExp(`^${upstream.replaceAll('.', '\\.')}\\-karvpn\\.[1-9]\\d*$`).test(version)
  ) {
    throw new Error('package.json does not match the adopted upstream version');
  }
  const next = nextKarvpnVersion(upstream, load('.release-please-manifest.json')['.']);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${next}\n`);
  else console.log(next);
}
