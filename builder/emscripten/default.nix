{ pkgs ? import <nixpkgs> { } }:
let
  emscripten = builtins.fetchTarball {
    url =
      "https://storage.googleapis.com/webassembly/emscripten-releases-builds/linux/cc8eba40de8235f9c33d92463018f87b3edaa09e/wasm-binaries.tar.xz";
    sha256 = "0s1mh3j3l6cdd98hh6vk1q1x9pdrkjsnxqy5mqjcalac6i92fw3d";
  };
in pkgs.stdenv.mkDerivation {
  name = "emcc-wrapped";

  src = ./.;

  EMSCRIPTEN = emscripten;

  EM_PATHS = pkgs.lib.strings.concatStringsSep ":" [
    "${emscripten}/bin"
    "${emscripten}/emscripten"
    "${pkgs.nodejs_20}/bin"
    "${pkgs.python3}/bin"
  ];

  installPhase = ./install.sh;
}
