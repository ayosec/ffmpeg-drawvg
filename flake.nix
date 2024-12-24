{
  description = "Emscripten";

  inputs = { nixpkgs.url = "nixpkgs/nixos-unstable"; };

  outputs = { self, nixpkgs, }:
    let
      system = "x86_64-linux";

      pkgs = nixpkgs.legacyPackages.${system};

      emscripten-wrapper = let

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

        nativeBuildInputs = [ pkgs.makeWrapper ];

        installPhase = let
          paths = pkgs.lib.strings.concatStringsSep ":" [
            "${emscripten}/bin"
            "${emscripten}/emscripten"
            "${pkgs.nodejs_20}/bin"
            "${pkgs.python3}/bin"
          ];
        in ''
          mkdir -p $out/bin

          find ${emscripten}/{bin,emscripten} -maxdepth 1 -type f -executable -print0 | \
          while read -rsd "" target
          do
              targetname=$(basename "$target")
              extra=""

              case "$targetname" in
                *.py)
                    continue
                    ;;

                emcc|em++)
                    extra='--cache="$EM_CACHE" '
                    ;;
              esac;

              wrapper="$out/bin/$targetname"
              {
                  echo '#!${pkgs.bash}/bin/bash'
                  echo 'export EM_CACHE=/tmp/em_cache.$UID'
                  echo 'PATH="${paths}:$PATH"'
                  printf 'exec %q %s"$@"\n' "$target" "$extra"
              } > "$wrapper"

              chmod +x "$wrapper"
          done

          ln -s $out/bin/emcc{,-wrapped}
        '';
      };

    in {
      #formatter.${system} = nixpkgs.legacyPackages.${system}.nixfmt;

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
