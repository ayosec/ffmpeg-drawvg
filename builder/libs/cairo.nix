{ pkgs, emscripten, pixman }:
let
  version = "1.18.2";

  cairo = pkgs.fetchurl {
    url = "https://www.cairographics.org/releases/cairo-${version}.tar.xz";
    sha256 = "0nnli5cghygbl9bvlbjls7nspnrrzx1y1pbd7p649s154js9nax6";
  };

  mesonConf = import ./meson.nix {
    inherit pkgs;
    disable = "fontconfig freetype glib png tests xcb zlib";
    extraFlags = [ "-Dc_args=-DCAIRO_NO_MUTEX" ];
  };

in pkgs.stdenv.mkDerivation (mesonConf // {
  inherit version;

  pname = "emscripten-cairo";

  src = cairo;

  nativeBuildInputs = with pkgs; [
    emscripten
    meson
    ninja
    pixman
    pkg-config
    python3
  ];

  preConfigure = ''
    patchShebangs version.py

    # Prevent pthread detection.
    sed -i 's/pthread.h/---no-pthread---/' meson-cc-tests/pthread.c
  '';
})
