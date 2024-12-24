{
  description = "Emscripten";

  inputs = { nixpkgs.url = "nixpkgs/nixos-unstable"; };

  outputs = { self, nixpkgs, }:
    let
      system = "x86_64-linux";

      pkgs = nixpkgs.legacyPackages.${system};

      emscripten-wrapper = import ./emscripten { inherit pkgs; };
    in {
      #formatter.${system} = pkgs.nixfmt;

      packages.${system}.default = emscripten-wrapper;

      devShells.${system}.default = pkgs.mkShell {

        packages = [
          emscripten-wrapper
          pkgs.wget
          pkgs.meson
          pkgs.ninja
          pkgs.pkg-config
          pkgs.nodejs_20
          pkgs.python3
        ];

      };
    };
}
