{ pkgs, emscripten }:
let

  pixman = pkgs.fetchurl {
    url = "https://www.cairographics.org/releases/pixman-0.43.4.tar.gz";
    sha256 = "09m2hm5zcz3n5wikz3f3v13ccdywjc81baf7kyvxviw006wlsqm0";
  };

  mesonConf = import ./meson.nix {
    inherit pkgs;
    disable = "demos tests";
    extraFlags = [ "-Dc_args=-DPIXMAN_NO_TLS" ];
  };

in pkgs.stdenv.mkDerivation (mesonConf // {

  name = "emscripten-pixman";

  src = pixman;

  buildInputs = with pkgs; [ emscripten meson ninja pkg-config ];

  preConfigure = ''
    # Prevent pthread detection.
    sed -i 's/pthread.h/---no-pthread---/' meson.build
  '';

})
