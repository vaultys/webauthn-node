import base64url from "base64url";
import { createHash } from "crypto";
import readline from "readline";

// Import the native module
// Note: You may need to configure your TypeScript setup to handle native modules
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fido2 = require("bindings")("fido2");

// Define types for WebAuthn API
export interface PublicKeyCredentialRpEntity {
  id: string;
  name?: string;
  icon?: string;
}

export interface PublicKeyCredentialUserEntity {
  id: Buffer | string | Uint8Array;
  name: string;
  displayName: string;
  icon?: string;
}

export interface PublicKeyCredentialParameters {
  type: string;
  alg: number;
}

export interface AuthenticatorSelectionCriteria {
  authenticatorAttachment?: "platform" | "cross-platform";
  requireResidentKey?: boolean;
  userVerification?: "required" | "preferred" | "discouraged";
}

export interface PublicKeyCredentialCreationOptions {
  rp: PublicKeyCredentialRpEntity;
  user: PublicKeyCredentialUserEntity;
  challenge: Buffer | string | Uint8Array;
  pubKeyCredParams: PublicKeyCredentialParameters[];
  timeout?: number;
  excludeCredentials?: PublicKeyCredentialDescriptor[];
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  attestation?: "none" | "indirect" | "direct";
  extensions?: Record<string, any>;
  device?: string; // Optional specific device path
  pin?: string;
  pinPrompt?: boolean; // If true, prompt for PIN interactively
}

export interface PublicKeyCredentialRequestOptions {
  challenge: Buffer | string | Uint8Array;
  timeout?: number;
  rpId: string;
  allowCredentials?: PublicKeyCredentialDescriptor[];
  userVerification?: "required" | "preferred" | "discouraged";
  extensions?: Record<string, any>;
  device?: string; // Optional specific device path
  pin?: string;
  pinPrompt?: boolean; // If true, prompt for PIN interactively
}

export interface PublicKeyCredentialDescriptor {
  type: string;
  id: Buffer | string | Uint8Array;
  transports?: string[];
}

export interface AuthenticatorResponse {
  clientDataJSON: Buffer;
}

export interface AuthenticatorAttestationResponse extends AuthenticatorResponse {
  attestationObject: Buffer;
  authenticatorData: Buffer;
}

export interface AuthenticatorAssertionResponse extends AuthenticatorResponse {
  authenticatorData: Buffer;
  signature: Buffer;
  userHandle: Buffer | null;
}

export interface PublicKeyCredential {
  id: string;
  rawId: Buffer;
  response: AuthenticatorAttestationResponse | AuthenticatorAssertionResponse;
  type: string;
  getClientExtensionResults?: () => Record<string, any>;
}

export interface CreateOptions {
  publicKey: PublicKeyCredentialCreationOptions;
}

export interface GetOptions {
  publicKey: PublicKeyCredentialRequestOptions;
}

export interface WebAuthnDevice {
  path: string;
  manufacturer: string;
  product: string;
}

export interface WebAuthnOptions {
  rpId?: string;
  rpName?: string;
  userVerification?: "required" | "preferred" | "discouraged";
  timeout?: number;
}

async function promptForPin(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Please enter your FIDO2 device PIN: ", (pin) => {
      rl.close();
      resolve(pin);
    });
  });
}

// WebAuthn class implementation
export class WebAuthn {
  private options: Required<WebAuthnOptions>;

  constructor(options: WebAuthnOptions = {}) {
    this.options = {
      rpId: options.rpId || "localhost",
      rpName: options.rpName || "WebAuthn Example",
      userVerification: options.userVerification || "preferred",
      timeout: options.timeout || 60000,
    };
  }

  /**
   * List available authenticator devices
   * @returns Array of connected FIDO2 devices
   */
  public listDevices(): WebAuthnDevice[] {
    return fido2.listDevices();
  }

  /**
   * Create credentials (equivalent to navigator.credentials.create())
   * @param options WebAuthn credential creation options
   * @returns Promise that resolves to the created credential
   */
  public async create(options: CreateOptions): Promise<PublicKeyCredential> {
    if (!options || !options.publicKey) {
      throw new Error("Missing required publicKey options");
    }

    const publicKey = options.publicKey;

    // Validate required parameters
    if (!publicKey.rp || !publicKey.rp.id) {
      throw new Error("Missing required rp.id parameter");
    }

    if (!publicKey.user || !publicKey.user.id || !publicKey.user.name || !publicKey.user.displayName) {
      throw new Error("Missing required user parameters");
    }

    if (!publicKey.challenge) {
      throw new Error("Missing required challenge parameter");
    }

    // Ensure challenge is a Buffer
    let challenge: Buffer;
    if (Buffer.isBuffer(publicKey.challenge)) {
      challenge = publicKey.challenge;
    } else if (typeof publicKey.challenge === "string") {
      challenge = Buffer.from(publicKey.challenge);
    } else if (ArrayBuffer.isView(publicKey.challenge)) {
      challenge = Buffer.from(publicKey.challenge.buffer, publicKey.challenge.byteOffset, publicKey.challenge.byteLength);
    } else {
      throw new Error("Challenge must be a Buffer, ArrayBufferView, or string");
    }

    // Create client data JSON (similar to what browsers would do)
    const clientDataJSON = JSON.stringify({
      type: "webauthn.create",
      challenge: base64url(challenge),
      origin: `https://${publicKey.rp.id}`,
      crossOrigin: false,
    });

    // Hash the client data
    const clientDataHash = createHash("sha256").update(clientDataJSON).digest();

    // Ensure user.id is a Buffer
    let userId: Buffer;
    if (Buffer.isBuffer(publicKey.user.id)) {
      userId = publicKey.user.id;
    } else if (typeof publicKey.user.id === "string") {
      userId = Buffer.from(publicKey.user.id);
    } else if (ArrayBuffer.isView(publicKey.user.id)) {
      userId = Buffer.from(publicKey.user.id.buffer, publicKey.user.id.byteOffset, publicKey.user.id.byteLength);
    } else {
      throw new Error("User ID must be a Buffer, ArrayBufferView, or string");
    }

    // Handle PIN if required
    let pin: string | undefined = publicKey.pin;

    try {
      // First attempt - try without PIN if not explicitly provided
      // Prepare parameters for libfido2
      const createParams = {
        rp: {
          id: publicKey.rp.id,
          name: publicKey.rp.name || this.options.rpName,
        },
        user: {
          id: userId,
          name: publicKey.user.name,
          displayName: publicKey.user.displayName,
        },
        challenge: clientDataHash,
        resident: publicKey.authenticatorSelection?.requireResidentKey || false,
        userVerification: publicKey.authenticatorSelection?.userVerification || this.options.userVerification,
        pin: pin,
      };

      if (publicKey.device) {
        (createParams as any).device = publicKey.device;
      }

      try {
        // Try to create credential
        const credential = fido2.makeCredential(createParams);

        // If successful, add client data JSON and return
        credential.response.clientDataJSON = Buffer.from(clientDataJSON);
        return credential;
      } catch (error: any) {
        // If PIN is required and we didn't provide one, or the PIN was incorrect
        if (error.message.includes("FIDO_ERR_PIN_REQUIRED") || error.message.includes("FIDO_ERR_PIN_INVALID")) {
          // If pinPrompt is true, prompt for PIN
          if (publicKey.pinPrompt) {
            pin = await promptForPin();
            // Update createParams with the new PIN
            createParams.pin = pin;

            // Try again with the PIN
            const credential = fido2.makeCredential(createParams);
            credential.response.clientDataJSON = Buffer.from(clientDataJSON);
            return credential;
          } else {
            // Otherwise, pass through the error
            throw error;
          }
        } else {
          // For other errors, pass through
          throw error;
        }
      }
    } catch (error: any) {
      throw new Error(`Error: ${error.message}`);
    }
  }

  /**
   * Get assertion (equivalent to navigator.credentials.get())
   * @param options WebAuthn assertion options
   * @returns Promise that resolves to the assertion
   */
  public async get(options: GetOptions): Promise<PublicKeyCredential> {
    if (!options || !options.publicKey) {
      throw new Error("Missing required publicKey options");
    }

    const publicKey = options.publicKey;

    // Validate required parameters
    if (!publicKey.rpId) {
      throw new Error("Missing required rpId parameter");
    }

    if (!publicKey.challenge) {
      throw new Error("Missing required challenge parameter");
    }

    // Ensure challenge is a Buffer
    let challenge: Buffer;
    if (Buffer.isBuffer(publicKey.challenge)) {
      challenge = publicKey.challenge;
    } else if (typeof publicKey.challenge === "string") {
      challenge = Buffer.from(publicKey.challenge);
    } else if (ArrayBuffer.isView(publicKey.challenge)) {
      challenge = Buffer.from(publicKey.challenge.buffer, publicKey.challenge.byteOffset, publicKey.challenge.byteLength);
    } else {
      throw new Error("Challenge must be a Buffer, ArrayBufferView, or string");
    }

    // Create client data JSON (similar to what browsers would do)
    const clientDataJSON = JSON.stringify({
      type: "webauthn.get",
      challenge: base64url(challenge),
      origin: `https://${publicKey.rpId}`,
      crossOrigin: false,
    });

    // Hash the client data
    const clientDataHash = createHash("sha256").update(clientDataJSON).digest();

    let pin: string | undefined = publicKey.pin;
    // Prepare parameters for libfido2
    const assertionParams: {
      rpId: string;
      challenge: Buffer;
      allowCredentials: { id: Buffer }[];
      userVerification?: string;
      device?: string;
      pin?: string;
    } = {
      rpId: publicKey.rpId,
      challenge: clientDataHash,
      allowCredentials: [],
      userVerification: publicKey.userVerification || this.options.userVerification,
      pin: pin,
    };

    // Add allowed credentials
    if (publicKey.allowCredentials && Array.isArray(publicKey.allowCredentials)) {
      for (const cred of publicKey.allowCredentials) {
        if (cred.id) {
          let credId: Buffer | undefined;
          if (Buffer.isBuffer(cred.id)) {
            credId = cred.id;
          } else if (typeof cred.id === "string") {
            credId = Buffer.from(cred.id);
          } else if (ArrayBuffer.isView(cred.id)) {
            credId = Buffer.from(cred.id.buffer, cred.id.byteOffset, cred.id.byteLength);
          }

          if (credId) {
            assertionParams.allowCredentials.push({ id: credId });
          }
        }
      }
    }

    // If a specific device was specified
    if (publicKey.device) {
      assertionParams.device = publicKey.device;
    }

    // Get assertion with libfido2
    try {
      // Try to get assertion
      const assertion = fido2.getAssertion(assertionParams);

      // If successful, add client data JSON and return
      assertion.response.clientDataJSON = Buffer.from(clientDataJSON);
      return assertion;
    } catch (error: any) {
      // If PIN is required and we didn't provide one, or the PIN was incorrect
      if (error.message.includes("FIDO_ERR_PIN_REQUIRED") || error.message.includes("FIDO_ERR_PIN_INVALID")) {
        // If pinPrompt is true, prompt for PIN
        if (publicKey.pinPrompt) {
          pin = await promptForPin();
          // Update assertionParams with the new PIN
          assertionParams.pin = pin;

          // Try again with the PIN
          const assertion = fido2.getAssertion(assertionParams);
          assertion.response.clientDataJSON = Buffer.from(clientDataJSON);
          return assertion;
        } else {
          // Otherwise, pass through the error
          throw error;
        }
      } else {
        // For other errors, pass through
        throw error;
      }
    }
  }
}

// Create a credentials object to mimic browser's navigator.credentials
class CredentialsContainer {
  /**
   * Create a new credential
   * @param options WebAuthn credential creation options
   * @returns Promise resolving to the created credential
   */
  public async create(options: CreateOptions): Promise<PublicKeyCredential> {
    const webauthn = new WebAuthn();
    return await webauthn.create(options);
  }

  /**
   * Get an assertion from an existing credential
   * @param options WebAuthn assertion options
   * @returns Promise resolving to the credential assertion
   */
  public async get(options: GetOptions): Promise<PublicKeyCredential> {
    const webauthn = new WebAuthn();
    return await webauthn.get(options);
  }
}

// Export the credentials object
export const credentials = new CredentialsContainer();
