import { credentials } from "./webauthn";
import * as crypto from "crypto";

async function main() {
  try {
    // Create a new credential
    console.log("Creating a new credential...");

    const credential = await credentials.create({
      publicKey: {
        rp: {
          id: "example.com",
          name: "Example WebAuthn App",
        },
        user: {
          id: crypto.randomBytes(16),
          name: "john.doe@example.com",
          displayName: "John Doe",
        },
        challenge: crypto.randomBytes(32),
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
        ],
        timeout: 60000,
        authenticatorSelection: {
          userVerification: "preferred",
          requireResidentKey: false,
        },
      },
    });

    console.log("Credential created!");
    console.log("Credential ID:", credential.id);

    // Store the credential ID for later authentication
    const storedCredentialId = credential.rawId;

    // Now authenticate with the credential
    console.log("\nAuthenticating with the credential...");

    const assertion = await credentials.get({
      publicKey: {
        rpId: "example.com",
        challenge: crypto.randomBytes(32),
        allowCredentials: [
          {
            type: "public-key",
            id: storedCredentialId,
          },
        ],
        timeout: 60000,
        userVerification: "preferred",
      },
    });

    console.log("Authentication successful!");
    console.log("Authenticator data length:", assertion.response.authenticatorData.length);
    console.log("Signature length:", (assertion.response as any).signature.length);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
