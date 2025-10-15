#!/bin/bash

npx bare-pack --target android-arm64 --target ios-arm64 --linked --out worklet/app.bundle.mjs worklet/app.js
