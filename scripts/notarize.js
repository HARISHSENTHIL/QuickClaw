const { notarize } = require('@electron/notarize')

exports.default = async function notarizing(context) {
  if (context.electronPlatformName !== 'darwin') return

  // Universal builds call afterSign once per arch slice before merging.
  // Only notarize the final assembled .app — skip the intermediate per-arch calls.
  if (context.arch !== undefined) {
    const { Arch } = require('electron-builder')
    if (context.arch !== Arch.universal) return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = `${context.appOutDir}/${appName}.app`

  console.log(`Notarizing ${appPath}…`)

  // Prefer keychain profile (stored via: xcrun notarytool store-credentials "OctoClawNotarize" ...)
  // Fallback to env vars for CI environments.
  if (process.env.NOTARIZE_KEYCHAIN_PROFILE || (!process.env.APPLE_ID)) {
    const profile = process.env.NOTARIZE_KEYCHAIN_PROFILE || 'OctoClawNotarize'
    console.log(`Using keychain profile: ${profile}`)
    await notarize({ tool: 'notarytool', appPath, keychainProfile: profile })
  } else if (process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.TEAM_ID) {
    console.log('Using env var credentials…')
    await notarize({
      tool: 'notarytool',
      appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.TEAM_ID,
    })
  } else {
    console.log('Skipping notarization: no credentials found.')
    console.log('Run: xcrun notarytool store-credentials "OctoClawNotarize" --apple-id <id> --team-id <tid> --password <app-specific-pw>')
    return
  }

  console.log('Notarization complete.')
}
