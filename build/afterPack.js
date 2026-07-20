/**
 * electron-builder afterPack hook.
 *
 * Bypasses electron-builder's `extraResources` logic for the Next.js standalone
 * server. extraResources silently strips the standalone's bundled
 * node_modules (because electron-builder special-cases anything that looks
 * like a "nested deps tree"). The standalone server crashes on launch with
 * `Cannot find module 'next'` because that node_modules dir is missing.
 *
 * Solution: after electron-builder finishes packaging, copy the entire
 * .next/standalone/ tree into Contents/Resources/standalone/ verbatim.
 */
const path = require("node:path");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const { execFileSync } = require("node:child_process");

exports.default = async (context) => {
  const { appOutDir, packager } = context;
  const projectDir = packager.projectDir;
  const productName = packager.appInfo.productName; // "Claude Config"
  const appBundle = path.join(appOutDir, `${productName}.app`);
  const dst = path.join(appBundle, "Contents", "Resources", "standalone");
  const src = path.join(projectDir, ".next", "standalone");

  if (!fsSync.existsSync(src)) {
    throw new Error(
      `afterPack: standalone not found at ${src}. Run \`npm run build:standalone\` first.`,
    );
  }

  // Remove whatever electron-builder put there (probably a partial copy
  // missing node_modules). Start clean.
  await fs.rm(dst, { recursive: true, force: true });
  await fs.mkdir(path.dirname(dst), { recursive: true });
  await fs.cp(src, dst, { recursive: true, dereference: false, verbatimSymlinks: false });

  // Sanity check: did `node_modules/next/` make it through?
  const nextDir = path.join(dst, "node_modules", "next");
  if (!fsSync.existsSync(nextDir)) {
    throw new Error(`afterPack: copy succeeded but ${nextDir} is missing.`);
  }

  // eslint-disable-next-line no-console
  console.log(`  ✓ afterPack: standalone copied verbatim → ${dst}`);

  // macOS: electron-builder is configured with `identity: null`, so it does NOT
  // sign the bundle — the .app keeps the stale ad-hoc seal from the prebuilt
  // Electron binary. Once we rename that binary and inject the asar + the
  // standalone tree above, the bundle no longer matches that seal, so
  // `codesign --verify` fails and macOS reports the app as
  // "damaged and can't be opened" — which right-click → Open cannot bypass.
  //
  // Re-sign the whole bundle ad-hoc so the seal is valid and consistent. This
  // does NOT make the app notarized (that needs a paid Developer ID); it just
  // downgrades Gatekeeper from the fatal "damaged" verdict to the ordinary
  // "unidentified developer" prompt, which users can clear via right-click →
  // Open or `xattr -dr com.apple.quarantine`. See README → Install on macOS.
  if (context.electronPlatformName === "darwin") {
    execFileSync("codesign", ["--force", "--deep", "--sign", "-", appBundle], {
      stdio: "inherit",
    });
    // eslint-disable-next-line no-console
    console.log(`  ✓ afterPack: ad-hoc re-signed ${productName}.app`);
  }
};
