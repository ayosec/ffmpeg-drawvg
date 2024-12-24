{ pkgs ? import <nixpkgs> { } }:
let
  # Install 3.1.74 from tarball because the package in Nix
  # requires openjdk21, which has a lot of dependencies.
  emscripten = builtins.fetchTarball {
    url =
      "https://storage.googleapis.com/webassembly/emscripten-releases-builds/linux/c2655005234810c7c42e02a18e4696554abe0352/wasm-binaries.tar.xz";
    sha256 = "0yvpb333mf01x3kr2k2aay070cj10dxzi1ds13gfqmzm5vr1m0fj";
  };
in pkgs.stdenv.mkDerivation {
  name = "emcc-wrapped";

  src = ./.;

  PKG_BASH = pkgs.bash;

  EMSCRIPTEN = emscripten;

  EM_PATHS = pkgs.lib.strings.concatStringsSep ":" [
    "${emscripten}/bin"
    "${emscripten}/emscripten"
    "${pkgs.nodejs_20}/bin"
    "${pkgs.python3}/bin"
  ];

  installPhase = builtins.readFile ./install.sh;
}
