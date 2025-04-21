#include <fido.h>
#include <iostream>
#include <napi.h>
#include <string>
#include <vector>

// Helper function to convert bytes to a Napi::Buffer
Napi::Buffer<uint8_t> makeBuffer(Napi::Env env, const unsigned char *data,
                                 size_t len) {
  uint8_t *buf = new uint8_t[len];
  memcpy(buf, data, len);
  return Napi::Buffer<uint8_t>::New(
      env, buf, len, [](Napi::Env, uint8_t *data) { delete[] data; });
}

// List available FIDO devices
Napi::Array ListDevices(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  fido_dev_info_t *dev_infos = fido_dev_info_new(64);
  size_t ndevs = 0;
  int r;

  r = fido_dev_info_manifest(dev_infos, 64, &ndevs);
  if (r != FIDO_OK) {
    Napi::Error::New(env, fido_strerr(r)).ThrowAsJavaScriptException();
    fido_dev_info_free(&dev_infos, ndevs);
    return Napi::Array::New(env, 0);
  }

  Napi::Array result = Napi::Array::New(env, ndevs);
  for (size_t i = 0; i < ndevs; i++) {
    Napi::Object device = Napi::Object::New(env);
    device.Set("path", fido_dev_info_path(fido_dev_info_ptr(dev_infos, i)));
    device.Set("manufacturer", fido_dev_info_manufacturer_string(
                                   fido_dev_info_ptr(dev_infos, i)));
    device.Set("product",
               fido_dev_info_product_string(fido_dev_info_ptr(dev_infos, i)));
    result[i] = device;
  }

  fido_dev_info_free(&dev_infos, ndevs);
  return result;
}

// Create credentials (equivalent to credentials.create())
Napi::Object MakeCredential(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  Napi::Object result = Napi::Object::New(env);

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Object argument expected")
        .ThrowAsJavaScriptException();
    return result;
  }

  Napi::Object options = info[0].As<Napi::Object>();

  // Extract options
  std::string rpId;
  std::string rpName;
  std::string userId;
  std::string userName;
  std::string userDisplayName;
  std::string challenge;
  std::string pin;

  if (options.Has("pin") && options.Get("pin").IsString()) {
    pin = options.Get("pin").As<Napi::String>();
  }

  if (options.Has("rp") && options.Get("rp").IsObject()) {
    Napi::Object rp = options.Get("rp").As<Napi::Object>();
    if (rp.Has("id") && rp.Get("id").IsString()) {
      rpId = rp.Get("id").As<Napi::String>();
    }
    if (rp.Has("name") && rp.Get("name").IsString()) {
      rpName = rp.Get("name").As<Napi::String>();
    }
  }

  if (options.Has("user") && options.Get("user").IsObject()) {
    Napi::Object user = options.Get("user").As<Napi::Object>();
    if (user.Has("id") && user.Get("id").IsBuffer()) {
      Napi::Buffer<uint8_t> idBuf = user.Get("id").As<Napi::Buffer<uint8_t>>();
      userId = std::string(reinterpret_cast<const char *>(idBuf.Data()),
                           idBuf.Length());
    }
    if (user.Has("name") && user.Get("name").IsString()) {
      userName = user.Get("name").As<Napi::String>();
    }
    if (user.Has("displayName") && user.Get("displayName").IsString()) {
      userDisplayName = user.Get("displayName").As<Napi::String>();
    }
  }

  if (options.Has("challenge") && options.Get("challenge").IsBuffer()) {
    Napi::Buffer<uint8_t> challengeBuf =
        options.Get("challenge").As<Napi::Buffer<uint8_t>>();
    challenge = std::string(reinterpret_cast<const char *>(challengeBuf.Data()),
                            challengeBuf.Length());
  }

  if (rpId.empty() || userId.empty() || challenge.empty()) {
    Napi::Error::New(env, "Missing required parameters")
        .ThrowAsJavaScriptException();
    return result;
  }

  // Get device path (can be optional - will use first device if not specified)
  std::string devicePath;
  if (options.Has("device") && options.Get("device").IsString()) {
    devicePath = options.Get("device").As<Napi::String>();
  } else {
    // Find first available device
    fido_dev_info_t *dev_infos = fido_dev_info_new(64);
    size_t ndevs = 0;
    int r = fido_dev_info_manifest(dev_infos, 64, &ndevs);
    if (r != FIDO_OK || ndevs == 0) {
      fido_dev_info_free(&dev_infos, ndevs);
      Napi::Error::New(env, "No FIDO2 devices found")
          .ThrowAsJavaScriptException();
      return result;
    }
    devicePath = fido_dev_info_path(fido_dev_info_ptr(dev_infos, 0));
    fido_dev_info_free(&dev_infos, ndevs);
  }

  // Create credential
  fido_cred_t *cred = fido_cred_new();
  if (!cred) {
    Napi::Error::New(env, "Failed to create credential structure")
        .ThrowAsJavaScriptException();
    return result;
  }

  // Set credential parameters
  int r;
  r = fido_cred_set_type(cred, COSE_ES256); // Default to ES256
  if (r != FIDO_OK) {
    fido_cred_free(&cred);
    Napi::Error::New(env, std::string("Failed to set credential type: ") +
                              fido_strerr(r))
        .ThrowAsJavaScriptException();
    return result;
  }

  r = fido_cred_set_rp(cred, rpId.c_str(), rpName.c_str());
  if (r != FIDO_OK) {
    fido_cred_free(&cred);
    Napi::Error::New(env, std::string("Failed to set RP: ") + fido_strerr(r))
        .ThrowAsJavaScriptException();
    return result;
  }

  r = fido_cred_set_user(
      cred, reinterpret_cast<const unsigned char *>(userId.c_str()),
      userId.length(), userName.c_str(), userDisplayName.c_str(), NULL);
  if (r != FIDO_OK) {
    fido_cred_free(&cred);
    Napi::Error::New(env, std::string("Failed to set user: ") + fido_strerr(r))
        .ThrowAsJavaScriptException();
    return result;
  }

  r = fido_cred_set_clientdata_hash(
      cred, reinterpret_cast<const unsigned char *>(challenge.c_str()),
      challenge.length());
  if (r != FIDO_OK) {
    fido_cred_free(&cred);
    Napi::Error::New(env,
                     std::string("Failed to set challenge: ") + fido_strerr(r))
        .ThrowAsJavaScriptException();
    return result;
  }

  // Set options
  if (options.Has("resident") && options.Get("resident").IsBoolean() &&
      options.Get("resident").As<Napi::Boolean>()) {
    r = fido_cred_set_rk(cred, FIDO_OPT_TRUE);
  } else {
    r = fido_cred_set_rk(cred, FIDO_OPT_FALSE);
  }

  if (r != FIDO_OK) {
    fido_cred_free(&cred);
    Napi::Error::New(env, std::string("Failed to set resident key option: ") +
                              fido_strerr(r))
        .ThrowAsJavaScriptException();
    return result;
  }

  if (options.Has("userVerification") &&
      options.Get("userVerification").IsString()) {
    std::string uv = options.Get("userVerification").As<Napi::String>();
    if (uv == "required") {
      r = fido_cred_set_uv(cred, FIDO_OPT_TRUE);
    } else if (uv == "preferred") {
      r = fido_cred_set_uv(cred, FIDO_OPT_OMIT);
    } else {
      r = fido_cred_set_uv(cred, FIDO_OPT_FALSE);
    }

    if (r != FIDO_OK) {
      fido_cred_free(&cred);
      Napi::Error::New(env, std::string("Failed to set user verification: ") +
                                fido_strerr(r))
          .ThrowAsJavaScriptException();
      return result;
    }
  }

  // Open device and make credential
  fido_dev_t *dev = fido_dev_new();
  if (!dev) {
    fido_cred_free(&cred);
    Napi::Error::New(env, "Failed to create device structure")
        .ThrowAsJavaScriptException();
    return result;
  }

  r = fido_dev_open(dev, devicePath.c_str());
  if (r != FIDO_OK) {
    fido_dev_close(dev);
    fido_dev_free(&dev);
    fido_cred_free(&cred);
    Napi::Error::New(env,
                     std::string("Failed to open device: ") + fido_strerr(r))
        .ThrowAsJavaScriptException();
    return result;
  }

  // Use PIN if provided
  r = fido_dev_make_cred(dev, cred, pin.empty() ? NULL : pin.c_str());
  fido_dev_close(dev);
  fido_dev_free(&dev);

  if (r != FIDO_OK) {
    fido_cred_free(&cred);
    Napi::Error::New(env, std::string("Failed to create credential: ") +
                              fido_strerr(r))
        .ThrowAsJavaScriptException();
    return result;
  }

  // Extract and return credential data
  size_t id_len = fido_cred_id_len(cred);
  const unsigned char *id_ptr = fido_cred_id_ptr(cred);

  result.Set("id", makeBuffer(env, id_ptr, id_len));
  result.Set("rawId", makeBuffer(env, id_ptr, id_len));

  Napi::Object response = Napi::Object::New(env);

  // Get attestation data
  size_t authData_len = fido_cred_authdata_len(cred);
  const unsigned char *authData_ptr = fido_cred_authdata_ptr(cred);
  response.Set("authenticatorData",
               makeBuffer(env, authData_ptr, authData_len));

  // Get attestation
  size_t attestation_len = fido_cred_x5c_len(cred);
  const unsigned char *attestation_ptr = fido_cred_x5c_ptr(cred);
  response.Set("attestationObject",
               makeBuffer(env, attestation_ptr, attestation_len));

  result.Set("response", response);
  result.Set("type", "public-key");

  fido_cred_free(&cred);
  return result;
}

// Get assertion (equivalent to credentials.get())
Napi::Object GetAssertion(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  Napi::Object result = Napi::Object::New(env);

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Object argument expected")
        .ThrowAsJavaScriptException();
    return result;
  }

  Napi::Object options = info[0].As<Napi::Object>();

  // Extract options
  std::string rpId;
  std::string challenge;
  std::vector<std::vector<uint8_t>> allowedCredentials;
  std::string pin;

  if (options.Has("pin") && options.Get("pin").IsString()) {
    pin = options.Get("pin").As<Napi::String>();
  }

  if (options.Has("rpId") && options.Get("rpId").IsString()) {
    rpId = options.Get("rpId").As<Napi::String>();
  }

  if (options.Has("challenge") && options.Get("challenge").IsBuffer()) {
    Napi::Buffer<uint8_t> challengeBuf =
        options.Get("challenge").As<Napi::Buffer<uint8_t>>();
    challenge = std::string(reinterpret_cast<const char *>(challengeBuf.Data()),
                            challengeBuf.Length());
  }

  if (options.Has("allowCredentials") &&
      options.Get("allowCredentials").IsArray()) {
    Napi::Array creds = options.Get("allowCredentials").As<Napi::Array>();
    for (uint32_t i = 0; i < creds.Length(); i++) {
      if (!creds.Get(i).IsObject())
        continue;

      Napi::Object cred = creds.Get(i).As<Napi::Object>();
      if (cred.Has("id") && cred.Get("id").IsBuffer()) {
        Napi::Buffer<uint8_t> idBuf =
            cred.Get("id").As<Napi::Buffer<uint8_t>>();
        std::vector<uint8_t> id(idBuf.Data(), idBuf.Data() + idBuf.Length());
        allowedCredentials.push_back(id);
      }
    }
  }

  if (rpId.empty() || challenge.empty()) {
    Napi::Error::New(env, "Missing required parameters")
        .ThrowAsJavaScriptException();
    return result;
  }

  // Get device path (can be optional - will use first device if not specified)
  std::string devicePath;
  if (options.Has("device") && options.Get("device").IsString()) {
    devicePath = options.Get("device").As<Napi::String>();
  } else {
    // Find first available device
    fido_dev_info_t *dev_infos = fido_dev_info_new(64);
    size_t ndevs = 0;
    int r = fido_dev_info_manifest(dev_infos, 64, &ndevs);
    if (r != FIDO_OK || ndevs == 0) {
      fido_dev_info_free(&dev_infos, ndevs);
      Napi::Error::New(env, "No FIDO2 devices found")
          .ThrowAsJavaScriptException();
      return result;
    }
    devicePath = fido_dev_info_path(fido_dev_info_ptr(dev_infos, 0));
    fido_dev_info_free(&dev_infos, ndevs);
  }

  // Create assertion
  fido_assert_t *assert = fido_assert_new();
  if (!assert) {
    Napi::Error::New(env, "Failed to create assertion structure")
        .ThrowAsJavaScriptException();
    return result;
  }

  // Set assertion parameters
  int r;
  r = fido_assert_set_rp(assert, rpId.c_str());
  if (r != FIDO_OK) {
    fido_assert_free(&assert);
    Napi::Error::New(env, std::string("Failed to set RP: ") + fido_strerr(r))
        .ThrowAsJavaScriptException();
    return result;
  }

  r = fido_assert_set_clientdata_hash(
      assert, reinterpret_cast<const unsigned char *>(challenge.c_str()),
      challenge.length());
  if (r != FIDO_OK) {
    fido_assert_free(&assert);
    Napi::Error::New(env,
                     std::string("Failed to set challenge: ") + fido_strerr(r))
        .ThrowAsJavaScriptException();
    return result;
  }

  // Add allowed credentials
  for (const auto &cred : allowedCredentials) {
    r = fido_assert_allow_cred(assert, cred.data(), cred.size());
    if (r != FIDO_OK) {
      fido_assert_free(&assert);
      Napi::Error::New(env, std::string("Failed to add allowed credential: ") +
                                fido_strerr(r))
          .ThrowAsJavaScriptException();
      return result;
    }
  }

  // Set options
  if (options.Has("userVerification") &&
      options.Get("userVerification").IsString()) {
    std::string uv = options.Get("userVerification").As<Napi::String>();
    if (uv == "required") {
      r = fido_assert_set_uv(assert, FIDO_OPT_TRUE);
    } else if (uv == "preferred") {
      r = fido_assert_set_uv(assert, FIDO_OPT_OMIT);
    } else {
      r = fido_assert_set_uv(assert, FIDO_OPT_FALSE);
    }

    if (r != FIDO_OK) {
      fido_assert_free(&assert);
      Napi::Error::New(env, std::string("Failed to set user verification: ") +
                                fido_strerr(r))
          .ThrowAsJavaScriptException();
      return result;
    }
  }

  // Open device and get assertion
  fido_dev_t *dev = fido_dev_new();
  if (!dev) {
    fido_assert_free(&assert);
    Napi::Error::New(env, "Failed to create device structure")
        .ThrowAsJavaScriptException();
    return result;
  }

  r = fido_dev_open(dev, devicePath.c_str());
  if (r != FIDO_OK) {
    fido_dev_close(dev);
    fido_dev_free(&dev);
    fido_assert_free(&assert);
    Napi::Error::New(env,
                     std::string("Failed to open device: ") + fido_strerr(r))
        .ThrowAsJavaScriptException();
    return result;
  }

  r = fido_dev_get_assert(dev, assert, pin.empty() ? NULL : pin.c_str());
  fido_dev_close(dev);
  fido_dev_free(&dev);

  if (r != FIDO_OK) {
    fido_assert_free(&assert);
    Napi::Error::New(env,
                     std::string("Failed to get assertion: ") + fido_strerr(r))
        .ThrowAsJavaScriptException();
    return result;
  }

  // Check if we got any assertions
  size_t assert_count = fido_assert_count(assert);
  if (assert_count == 0) {
    fido_assert_free(&assert);
    Napi::Error::New(env, "No assertion returned").ThrowAsJavaScriptException();
    return result;
  }

  // Extract and return assertion data
  // We'll return the first assertion if multiple are returned
  size_t id_len = fido_assert_id_len(assert, 0);
  const unsigned char *id_ptr = fido_assert_id_ptr(assert, 0);

  result.Set("id", makeBuffer(env, id_ptr, id_len));
  result.Set("rawId", makeBuffer(env, id_ptr, id_len));

  Napi::Object response = Napi::Object::New(env);

  // Get authenticator data
  size_t authData_len = fido_assert_authdata_len(assert, 0);
  const unsigned char *authData_ptr = fido_assert_authdata_ptr(assert, 0);
  response.Set("authenticatorData",
               makeBuffer(env, authData_ptr, authData_len));

  // Get signature
  size_t sig_len = fido_assert_sig_len(assert, 0);
  const unsigned char *sig_ptr = fido_assert_sig_ptr(assert, 0);
  response.Set("signature", makeBuffer(env, sig_ptr, sig_len));

  // Get user handle (if present)
  size_t user_id_len = fido_assert_user_id_len(assert, 0);
  if (user_id_len > 0) {
    const unsigned char *user_id_ptr = fido_assert_user_id_ptr(assert, 0);
    response.Set("userHandle", makeBuffer(env, user_id_ptr, user_id_len));
  } else {
    response.Set("userHandle", env.Null());
  }

  result.Set("response", response);
  result.Set("type", "public-key");

  fido_assert_free(&assert);
  return result;
}

// Initialize the module
Napi::Object Init(Napi::Env env, Napi::Object exports) {
  // Initialize libfido2
  fido_init(0);

  exports.Set(Napi::String::New(env, "listDevices"),
              Napi::Function::New(env, ListDevices));
  exports.Set(Napi::String::New(env, "makeCredential"),
              Napi::Function::New(env, MakeCredential));
  exports.Set(Napi::String::New(env, "getAssertion"),
              Napi::Function::New(env, GetAssertion));
  return exports;
}

NODE_API_MODULE(fido2, Init)
