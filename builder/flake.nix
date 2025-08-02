{
  description = "Emscripten";

  inputs = { nixpkgs.url = "nixpkgs/nixos-unstable"; };

  outputs = { self, nixpkgs, }:
    let
      system = "x86_64-linux";

      pkgs = nixpkgs.legacyPackages.${system}.extend
        (final: prev: { jre = prev.jre_headless; });

      emscripten = pkgs.emscripten;

      pixman = import ./libs/pixman.nix { inherit pkgs emscripten; };

      cairo = import ./libs/cairo.nix { inherit pkgs emscripten pixman; };
    in {
      formatter.${system} = pkgs.nixfmt-classic;

      devShells.${system} = {
        default = pkgs.mkShell {

          packages = [
            cairo
            emscripten
            pixman
            pkgs.libwebp
            pkgs.nodejs_20
            pkgs.optipng
            pkgs.pkg-config
            pkgs.python3
          ];

        };

        ffmpeg = pkgs.mkShell.override { stdenv = pkgs.clangStdenv; } {
          buildInputs = with pkgs; [
            fontconfig
            git
            gnumake
            harfbuzz
            libaom
            librsvg
            libvpx
            nasm
            pkg-config
            pkgs.cairo
          ];
        };
      };
    };
}
