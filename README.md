# WebAuthn Node

A native Node.js implementation of the WebAuthn API using libfido2.

## Requirements

- Node.js 14+
- Platform-specific requirements:
  - **Linux**: libfido2-dev package
  - **macOS**: Homebrew
  - **Windows**: Administrator rights (for Chocolatey installation)

## Installation

```bash
npm install @vaultys/webauthn-node
```

The installation process will automatically:
1. Install libfido2 for your platform
2. Build the native module
3. Compile the TypeScript code

## Usage

Run this file, you will be prompted a pin if needed and if FIDO2_PIN has not been set

```javascript
import { credentials } from 'webauthn-node';
import * as crypto from 'crypto';

async function main() {
  try {
    // Create a new credential
    console.log("Creating a new credential...");

    const credential = await credentials.create({
      publicKey: {
        rp: {
          id: "example.com",
          name: "Example WebAuthn App"
        },
        user: {
          id: crypto.randomBytes(16),
          name: "john.doe@example.com",
          displayName: "John Doe"
        },
        challenge: crypto.randomBytes(32),
        pubKeyCredParams: [
          { type: "public-key", alg: -7 } // ES256
        ],
        timeout: 60000,
        authenticatorSelection: {
          userVerification: "preferred",
          requireResidentKey: false
        },
      }
    });

    console.log("Credential created!");
    console.log("Credential ID:", credential.id);

    // Store the credential ID for later authentication
    const storedCredentialId = credential.rawId;

    // Authenticate with the credential
    console.log("\nAuthenticating with the credential...");

    const assertion = await credentials.get({
      publicKey: {
        rpId: "example.com",
        challenge: crypto.randomBytes(32),
        allowCredentials: [{
          type: "public-key",
          id: storedCredentialId
        }],
        timeout: 60000,
        userVerification: "preferred",
      }
    });

    console.log("Authentication successful!");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
```

## API Documentation

### WebAuthn Class

The main class providing WebAuthn functionality.

```typescript
const webauthn = new WebAuthn(options);
```

#### Options

- `rpId`: Relying Party ID (default: 'localhost')
- `rpName`: Relying Party Name (default: 'WebAuthn Example')
- `userVerification`: User verification requirement (default: 'preferred')
- `timeout`: Operation timeout in milliseconds (default: 60000)

#### Methods

- `listDevices()`: List available authenticator devices
- `create(options)`: Create a new credential
- `get(options)`: Get an assertion from an existing credential

### credentials Object

A convenience object mimicking the browser's navigator.credentials API.

- `credentials.create(options)`: Create a new credential
- `credentials.get(options)`: Get an assertion from an existing credential

## Testing
you should plug your test fido2 key before (like yubikey)

run tests using
`FIDO2_PIN=123456 npm run test`

Touch your key 12 times to finish the tests


## Troubleshooting

### Linux

If you encounter permissions issues accessing the authenticator, you may need to add udev rules:

```bash
sudo tee /etc/udev/rules.d/70-fido.rules > /dev/null << EOF
# USB FIDO2 key
KERNEL=="hidraw*", SUBSYSTEM=="hidraw", ATTRS{idVendor}=="1050", ATTRS{idProduct}=="0407", TAG+="uaccess"
# Yubico devices
KERNEL=="hidraw*", SUBSYSTEM=="hidraw", ATTRS{idVendor}=="1050", MODE="0660", GROUP="plugdev"
EOF
sudo udevadm control --reload-rules && sudo udevadm trigger
```

### Windows

If the automatic installation fails, try installing libfido2 manually:

1. Download the latest release from [Yubico's libfido2 releases](https://developers.yubico.com/libfido2/Releases/)
2. Install the package
3. Set the environment variable: `LIBFIDO2_PATH=C:\path\to\libfido2`
4. Rebuild the module: `npm rebuild`

### macOS

If you encounter issues with the installation, try:

```bash
brew update
brew uninstall libfido2
brew install libfido2
npm rebuild
```

## License

MIT
