{
  "targets": [
    {
      "target_name": "fido2",
      "sources": [ "src/fido2.cc" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "conditions": [
        ['OS=="linux"', {
          "include_dirs": [
            "/usr/include",
            "/usr/local/include"
          ],
          "libraries": [
            "-lfido2"
          ]
        }],
        ['OS=="mac"', {
          "include_dirs": [
            "/usr/local/include",
            "/opt/homebrew/include"
          ],
          "libraries": [
            "-L/usr/local/lib",
            "-L/opt/homebrew/lib",
            "-lfido2"
          ]
        }],
        ['OS=="win"', {
          "include_dirs": [
            "<!(echo %LIBFIDO2_PATH%\\include)",
            "C:\\Program Files\\libfido2\\include"
          ],
          "libraries": [
            "<!(echo %LIBFIDO2_PATH%\\lib\\fido2.lib)",
            "C:\\Program Files\\libfido2\\lib\\fido2.lib"
          ],
          "copies": [
            {
              "destination": "<(module_root_dir)/build/Release",
              "files": [
                "<!(echo %LIBFIDO2_PATH%\\bin\\fido2.dll || echo C:\\Program Files\\libfido2\\bin\\fido2.dll)"
              ]
            }
          ]
        }]
      ]
    },
    {
      "target_name": "action_after_build",
      "type": "none",
      "dependencies": [ "fido2" ],
      "copies": [
        {
          "files": [ "<(PRODUCT_DIR)/fido2.node" ],
          "destination": "<(module_root_dir)/binding/darwin-<(target_arch)/",
          "conditions": [
            ["OS=='mac'", {}]
          ]
        },
        {
          "files": [ "<(PRODUCT_DIR)/fido2.node" ],
          "destination": "<(module_root_dir)/binding/linux-<(target_arch)/",
          "conditions": [
            ["OS=='linux'", {}]
          ]
        },
        {
          "files": [ "<(PRODUCT_DIR)/fido2.node" ],
          "destination": "<(module_root_dir)/binding/win32-<(target_arch)/",
          "conditions": [
            ["OS=='win'", {}]
          ]
        }
      ]
    }
  ]
}
