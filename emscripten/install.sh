#!/bin/bash

mkdir -p "$out/bin"

EM_CONFIG="$out/emscripten.conf"

echo 'FROZEN_CACHE = True' > "$EM_CONFIG"

find "$EMSCRIPTEN"/{bin,emscripten} -maxdepth 1 -type f -executable -print0 | \
    while read -rsd '' target
    do
      targetname=$(basename "$target")

      if [[ "$targetname" = *.py ]]
      then
          continue
      fi

      wrapper="$out/bin/$targetname"

      {
          printf '#! %s/bin/bash\n' "$PKG_BASH"
          printf 'export EM_CONFIG=%q\n' "$EM_CONFIG"
          printf 'PATH="%s:$PATH"\n' "$EM_PATHS"
          printf 'exec %q "$@"\n' "$target"
      } > "$wrapper"

      chmod +x "$wrapper"
    done

ln -s "$out"/bin/emcc{,-wrapped}
