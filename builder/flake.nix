{
  description = "Emscripten";

  inputs = { nixpkgs.url = "nixpkgs/nixos-unstable"; };

  outputs = { self, nixpkgs, }:
    let
      system = "x86_64-linux";

      pkgs = nixpkgs.legacyPackages.${system};

      emscripten = import ./emscripten { inherit pkgs; };

      pixman = import ./libs/pixman.nix { inherit pkgs emscripten; };

      cairo = import ./libs/cairo.nix { inherit pkgs emscripten pixman; };
    in {
      formatter.${system} = pkgs.nixfmt-classic;

      packages.${system} = {
        default = emscripten;

        pixman = pixman;

        cairo = cairo;
      };

      devShells.${system}.default = pkgs.mkShell {

        packages = [
          cairo
          emscripten
          pixman
          pkgs.jq
          pkgs.meson
          pkgs.ninja
          pkgs.nodejs_20
          pkgs.pkg-config
          pkgs.python3
        ];

      };
    };
}
