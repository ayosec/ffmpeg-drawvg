{ pkgs, emscripten, pixman }:
let

  cairo = pkgs.fetchurl {
    url = "https://www.cairographics.org/releases/cairo-1.18.2.tar.xz";
    sha256 = "0nnli5cghygbl9bvlbjls7nspnrrzx1y1pbd7p649s154js9nax6";
  };

  mesonConf = import ./meson.nix {
    inherit pkgs;
    disable = "fontconfig freetype glib png tests xcb zlib";
    extraFlags = [ "-Dc_args=-DCAIRO_NO_MUTEX" ];
  };

in pkgs.stdenv.mkDerivation (mesonConf // {

  name = "emscripten-cairo";

  src = cairo;

  buildInputs = with pkgs; [ emscripten meson ninja pixman pkg-config python3 ];

  preConfigure = ''
    # Prevent pthread detection.
    sed -i 's/pthread.h/---no-pthread---/' meson-cc-tests/pthread.c
  '';

})
