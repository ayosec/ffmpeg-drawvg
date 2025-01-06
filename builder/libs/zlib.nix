{ pkgs, emscripten }:
let

  version = "1.3.1";

  pixman = pkgs.fetchurl {
    url =
      "https://github.com/madler/zlib/releases/download/v${version}/zlib-${version}.tar.gz";
    sha256 = "mpOyt9/ax3zrpaVYpYDnRmfdb+3kWFuR7vtg8Dty3yM=";
  };

in pkgs.stdenv.mkDerivation {
  inherit version;

  pname = "emscripten-zlib";

  src = pixman;

  nativeBuildInputs = with pkgs; [ emscripten ];

  dontStrip = true;

  configurePhase = ''
    emconfigure ./configure --prefix "$out" --static
  '';

  buildPhase = ''
    emmake make
  '';

  installPhase = ''
    emmake make install
  '';

}
