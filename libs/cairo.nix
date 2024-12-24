{ pkgs, emscripten, pixman }:
let

  cairo = pkgs.fetchurl {
    url = "https://www.cairographics.org/releases/cairo-1.18.2.tar.xz";
    sha256 = "0nnli5cghygbl9bvlbjls7nspnrrzx1y1pbd7p649s154js9nax6";
  };

  crossfile = pkgs.writeTextFile {
    name = "emscripten-crossfile.meson";
    text = builtins.readFile ./emscripten-crossfile.meson;
  };

  words = pkgs.lib.strings.splitString " ";

  disabled = map (feature: "-D${feature}=disabled")
    (words "fontconfig freetype glib png tests xcb zlib");

in pkgs.stdenv.mkDerivation {

  name = "emscripten-cairo";

  src = cairo;

  buildInputs = with pkgs; [ emscripten meson ninja pixman pkg-config python3 ];

  mesonAutoFeatures = "disabled";

  mesonBuildType = "release";

  mesonFlags = disabled ++ [
    "--cross-file=${crossfile}"
    "--default-library=static"
    "-Dc_args=-DCAIRO_NO_MUTEX"
  ];

  preConfigure = ''
    # Prevent pthread detection.
    sed -i 's/pthread.h/---no-pthread---/' meson-cc-tests/pthread.c
  '';

}
