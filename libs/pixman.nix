{ pkgs, emscripten }:
let

  pixman = pkgs.fetchurl {
    url = "https://www.cairographics.org/releases/pixman-0.43.4.tar.gz";
    sha256 = "09m2hm5zcz3n5wikz3f3v13ccdywjc81baf7kyvxviw006wlsqm0";
  };

  crossfile = pkgs.writeTextFile {
    name = "emscripten-crossfile.meson";
    text = builtins.readFile ./emscripten-crossfile.meson;
  };

in pkgs.stdenv.mkDerivation {

  name = "emscripten-pixman";

  src = pixman;

  buildInputs = with pkgs; [ emscripten meson ninja pkg-config ];

  mesonAutoFeatures = "disabled";

  mesonBuildType = "release";

  mesonFlags = [
    "--cross-file=${crossfile}"
    "--default-library=static"
    "-Dtests=disabled"
    "-Ddemos=disabled"
    "-Dc_args=-DPIXMAN_NO_TLS"
  ];

  preConfigure = ''
    # Prevent pthread detection.
    sed -i 's/pthread.h/---no-pthread---/' meson.build
  '';

}
