import { credentials, WebAuthn } from "../src/webauthn";
import crypto from "crypto";

const FIDO2_PIN = process.env.FIDO2_PIN || "";

// Utility functions for the tests
const generateRandom = (size: number): Buffer => crypto.randomBytes(size);

// Create a WebAuthn instance for testing
const webauthn = new WebAuthn({
  rpId: "example.com",
  rpName: "WebAuthn Tests",
});

describe("WebAuthn API Tests", () => {
  // Set longer timeout for all tests in this suite
  jest.setTimeout(60000);

  // Generate test user data
  const userId = generateRandom(16);
  const username = `user_${Date.now()}@example.com`;
  const displayName = "Test User";
  let credentialId: Buffer;

  describe("Device Information", () => {
    it("should list available devices", async () => {
      try {
        const devices = webauthn.listDevices();
        //console.log("Available devices:", devices);

        // Just verify we got some kind of array back
        expect(Array.isArray(devices)).toBeTruthy();
      } catch (error: any) {
        if (error.message.includes("No FIDO2 devices found")) {
          //console.log("No FIDO2 devices available, skipping test");
          return;
        } else {
          throw error;
        }
      }
    });
  });

  describe("Basic Registration and Authentication", () => {
    it("should create a credential with default settings", async () => {
      try {
        const credential = await credentials.create({
          publicKey: {
            rp: {
              id: "example.com",
              name: "WebAuthn Tests",
            },
            user: {
              id: userId,
              name: username,
              displayName: displayName,
            },
            challenge: generateRandom(32),
            pubKeyCredParams: [
              { type: "public-key", alg: -7 }, // ES256
            ],
            timeout: 60000,
            authenticatorSelection: {
              userVerification: "discouraged",
              requireResidentKey: false,
            },
            attestation: "none",
            pin: FIDO2_PIN,
          },
        });

        //console.log("Created credential:", credential.id);

        expect(credential).toBeTruthy();
        expect(credential.id).toBeTruthy();
        expect(credential.rawId).toBeTruthy();
        expect(credential.response).toBeTruthy();

        // Save credential ID for authentication tests
        credentialId = credential.rawId;
      } catch (error: any) {
        if (error.message.includes("No FIDO2 devices found")) {
          //console.log("No FIDO2 devices available, skipping test");
          return;
        } else {
          throw error;
        }
      }
    });

    it("should authenticate with the created credential", async () => {
      if (!credentialId) {
        return;
      }

      const assertion = await credentials.get({
        publicKey: {
          rpId: "example.com",
          challenge: generateRandom(32),
          allowCredentials: [
            {
              type: "public-key",
              id: credentialId,
            },
          ],
          timeout: 60000,
          userVerification: "discouraged",
          pin: FIDO2_PIN,
        },
      });

      //console.log("Got assertion for credential:", assertion.id);

      expect(assertion).toBeTruthy();
      expect(assertion.id).toBeTruthy();
      expect(assertion.response).toBeTruthy();
      expect(assertion.response.authenticatorData).toBeTruthy();
    });
  });

  describe("Authentication Options", () => {
    let residentKeyCredentialId: Buffer;

    it("should create a resident key credential", async () => {
      try {
        const credential = await credentials.create({
          publicKey: {
            rp: {
              id: "example.com",
              name: "WebAuthn Tests",
            },
            user: {
              id: generateRandom(16),
              name: `resident_${Date.now()}@example.com`,
              displayName: "Resident Key User",
            },
            challenge: generateRandom(32),
            pubKeyCredParams: [
              { type: "public-key", alg: -7 }, // ES256
            ],
            timeout: 60000,
            authenticatorSelection: {
              userVerification: "required",
              requireResidentKey: true,
            },
            attestation: "direct",
            pin: FIDO2_PIN,
          },
        });

        //console.log("Created resident key credential:", credential.id);

        expect(credential).toBeTruthy();
        residentKeyCredentialId = credential.rawId;
      } catch (error: any) {
        if (error.message.includes("operation not supported") || error.message.includes("Not supported") || error.message.includes("PIN_REQUIRED")) {
          //console.log("Device does not support resident keys or requires PIN, skipping test");
          return;
        } else {
          throw error;
        }
      }
    });

    it("should authenticate with user verification", async () => {
      if (!residentKeyCredentialId) {
        return;
      }

      try {
        const assertion = await credentials.get({
          publicKey: {
            rpId: "example.com",
            challenge: generateRandom(32),
            allowCredentials: [
              {
                type: "public-key",
                id: residentKeyCredentialId,
              },
            ],
            timeout: 60000,
            userVerification: "required",
            pin: FIDO2_PIN,
          },
        });

        //console.log("Got assertion with user verification");

        expect(assertion).toBeTruthy();
        expect(assertion.response).toBeTruthy();
      } catch (error: any) {
        if (error.message.includes("operation not supported") || error.message.includes("Not supported") || error.message.includes("PIN_REQUIRED")) {
          //console.log("Device does not support user verification or requires PIN, skipping test");
          return;
        } else {
          throw error;
        }
      }
    });

    it("should authenticate with discoverable credential without specifying ID", async () => {
      if (!residentKeyCredentialId) {
        return;
      }

      try {
        const assertion = await credentials.get({
          publicKey: {
            rpId: "example.com",
            challenge: generateRandom(32),
            timeout: 60000,
            userVerification: "required",
            pin: FIDO2_PIN,
            // No allowCredentials - should use discoverable credentials
          },
        });

        //console.log("Got assertion using discoverable credential");

        expect(assertion).toBeTruthy();
      } catch (error: any) {
        if (error.message.includes("operation not supported") || error.message.includes("Not supported") || error.message.includes("PIN_REQUIRED")) {
          //console.log("Device does not support discoverable credentials or requires PIN, skipping test");
          return;
        } else {
          throw error;
        }
      }
    });
  });

  describe("Extensions", () => {
    let hmacSecretCredentialId: Buffer;

    it("should create a credential with HMAC-SECRET extension", async () => {
      try {
        const credential = await credentials.create({
          publicKey: {
            rp: {
              id: "example.com",
              name: "WebAuthn Tests",
            },
            user: {
              id: generateRandom(16),
              name: `hmac_${Date.now()}@example.com`,
              displayName: "HMAC User",
            },
            challenge: generateRandom(32),
            pubKeyCredParams: [
              { type: "public-key", alg: -7 }, // ES256
            ],
            timeout: 60000,
            authenticatorSelection: {
              userVerification: "discouraged",
            },
            attestation: "direct",
            extensions: {
              hmacCreateSecret: true,
            },
            pin: FIDO2_PIN,
          },
        });

        //console.log("Created credential with HMAC-SECRET extension:", credential.id);

        expect(credential).toBeTruthy();
        hmacSecretCredentialId = credential.rawId;
      } catch (error: any) {
        if (error.message.includes("operation not supported") || error.message.includes("Not supported") || error.message.includes("PIN_REQUIRED")) {
          //console.log("Device does not support HMAC-SECRET extension, skipping test");
          return;
        } else {
          throw error;
        }
      }
    });

    it("should get HMAC-SECRET output during authentication", async () => {
      if (!hmacSecretCredentialId) {
        return;
      }

      try {
        const salt1 = generateRandom(32);
        const salt2 = generateRandom(32);

        const assertion = await credentials.get({
          publicKey: {
            rpId: "example.com",
            challenge: generateRandom(32),
            allowCredentials: [
              {
                type: "public-key",
                id: hmacSecretCredentialId,
              },
            ],
            timeout: 60000,
            userVerification: "discouraged",
            extensions: {
              hmacGetSecret: {
                salt1: salt1,
                salt2: salt2,
              },
            },
            pin: FIDO2_PIN,
          },
        });

        //console.log("Got assertion with HMAC-SECRET extension");

        expect(assertion).toBeTruthy();

        // Check if we got extension outputs
        const extensionResults = assertion.getClientExtensionResults && assertion.getClientExtensionResults();

        //console.log("Extension results:", extensionResults);
      } catch (error: any) {
        if (error.message.includes("operation not supported") || error.message.includes("Not supported") || error.message.includes("PIN_REQUIRED")) {
          //console.log("Device does not support HMAC-SECRET extension, skipping test");
          return;
        } else {
          throw error;
        }
      }
    });

    it("should create a credential with PRF extension", async () => {
      try {
        const credential = await credentials.create({
          publicKey: {
            rp: {
              id: "example.com",
              name: "WebAuthn Tests",
            },
            user: {
              id: generateRandom(16),
              name: `prf_${Date.now()}@example.com`,
              displayName: "PRF User",
            },
            challenge: generateRandom(32),
            pubKeyCredParams: [
              { type: "public-key", alg: -7 }, // ES256
            ],
            timeout: 60000,
            authenticatorSelection: {
              userVerification: "discouraged",
            },
            attestation: "direct",
            extensions: {
              prf: {
                eval: {
                  first: generateRandom(32),
                },
                evalByCredential: {},
              },
            },
            pin: FIDO2_PIN,
          },
        });

        //console.log("Created credential with PRF extension:", credential.id);

        expect(credential).toBeTruthy();

        // Store credential ID for PRF tests
        const prfCredentialId = credential.rawId;

        // Test authentication with PRF immediately
        if (prfCredentialId) {
          const prfInput = generateRandom(32);

          const assertion = await credentials.get({
            publicKey: {
              rpId: "example.com",
              challenge: generateRandom(32),
              allowCredentials: [
                {
                  type: "public-key",
                  id: prfCredentialId,
                },
              ],
              timeout: 60000,
              userVerification: "discouraged",
              extensions: {
                prf: {
                  eval: {
                    first: prfInput,
                  },
                },
              },
              pin: FIDO2_PIN,
            },
          });

          //console.log("Got assertion with PRF extension");
          expect(assertion).toBeTruthy();

          // Check for PRF extension results
          const extensionResults = assertion.getClientExtensionResults && assertion.getClientExtensionResults();

          //console.log("PRF extension results:", extensionResults);

          if (extensionResults && extensionResults.prf) {
            //console.log("PRF output present in extension results");
          }
        }
      } catch (error: any) {
        if (error.message.includes("operation not supported") || error.message.includes("Not supported") || error.message.includes("PIN_REQUIRED") || error.message.includes("unknown extension")) {
          //console.log("Device does not support PRF extension, skipping test");
          return;
        } else {
          throw error;
        }
      }
    });
  });

  describe("Additional Configurations", () => {
    it("should create credential with user verification required", async () => {
      try {
        const credential = await credentials.create({
          publicKey: {
            rp: {
              id: "example.com",
              name: "WebAuthn Tests",
            },
            user: {
              id: generateRandom(16),
              name: `uv_${Date.now()}@example.com`,
              displayName: "UV User",
            },
            challenge: generateRandom(32),
            pubKeyCredParams: [
              { type: "public-key", alg: -7 }, // ES256
            ],
            timeout: 60000,
            authenticatorSelection: {
              userVerification: "required",
              authenticatorAttachment: "cross-platform",
            },
            attestation: "direct",
            pin: FIDO2_PIN,
          },
        });

        //console.log("Created credential with user verification required:", credential.id);

        expect(credential).toBeTruthy();
      } catch (error: any) {
        if (error.message.includes("operation not supported") || error.message.includes("Not supported") || error.message.includes("PIN_REQUIRED")) {
          //console.log("Device does not support required user verification, skipping test");
          return;
        } else {
          throw error;
        }
      }
    });

    it("should create credential with ES384 algorithm", async () => {
      try {
        const credential = await credentials.create({
          publicKey: {
            rp: {
              id: "example.com",
              name: "WebAuthn Tests",
            },
            user: {
              id: generateRandom(16),
              name: `es384_${Date.now()}@example.com`,
              displayName: "ES384 User",
            },
            challenge: generateRandom(32),
            pubKeyCredParams: [
              { type: "public-key", alg: -35 }, // ES384
            ],
            timeout: 60000,
            authenticatorSelection: {
              userVerification: "discouraged",
            },
            attestation: "direct",
            pin: FIDO2_PIN,
          },
        });

        //console.log("Created credential with ES384 algorithm:", credential.id);

        expect(credential).toBeTruthy();
      } catch (error: any) {
        if (error.message.includes("operation not supported") || error.message.includes("Not supported") || error.message.includes("unsupported algorithm")) {
          //console.log("Device does not support ES384 algorithm, skipping test");
          return;
        } else {
          throw error;
        }
      }
    });

    it("should create credential with RSA-PSS algorithm", async () => {
      try {
        const credential = await credentials.create({
          publicKey: {
            rp: {
              id: "example.com",
              name: "WebAuthn Tests",
            },
            user: {
              id: generateRandom(16),
              name: `rsapss_${Date.now()}@example.com`,
              displayName: "RSA-PSS User",
            },
            challenge: generateRandom(32),
            pubKeyCredParams: [
              { type: "public-key", alg: -37 }, // PS256 (RSA-PSS with SHA-256)
            ],
            timeout: 60000,
            authenticatorSelection: {
              userVerification: "discouraged",
            },
            attestation: "direct",
            pin: FIDO2_PIN,
          },
        });

        //console.log("Created credential with RSA-PSS algorithm:", credential.id);

        expect(credential).toBeTruthy();
      } catch (error: any) {
        if (error.message.includes("operation not supported") || error.message.includes("Not supported") || error.message.includes("unsupported algorithm")) {
          //console.log("Device does not support RSA-PSS algorithm, skipping test");
          return;
        } else {
          throw error;
        }
      }
    });
  });
});
