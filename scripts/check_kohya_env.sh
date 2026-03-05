#!/usr/bin/env bash
VENV_DIR="/Users/calbotsman/clawd/.venv-kohya"
PY="$VENV_DIR/bin/python"
if [ ! -x "$PY" ]; then
  echo "MISSING_VENV"
  exit 2
fi
"$PY" -c "import importlib,sys
missing=[]
for m in ('diffusers','peft','transformers'):
 try:
  importlib.import_module(m)
 except Exception as e:
  missing.append(m)
if missing:
 print('MISSING:'+','.join(missing)); sys.exit(2)
else:
 print('DEPS_OK')"
