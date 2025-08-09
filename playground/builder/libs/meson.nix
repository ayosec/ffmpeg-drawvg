{ pkgs, disable, extraFlags }:
let

  disableFlags = map (feature: "-D${feature}=disabled")
    (pkgs.lib.strings.splitString " " disable);

  crossfile = pkgs.writeTextFile {
    name = "emscripten-crossfile.meson";
    text = builtins.readFile ./emscripten-crossfile.meson;
  };

  basicFlags = [ "--cross-file=${crossfile}" "--default-library=static" ];

in {

  mesonAutoFeatures = "disabled";

  mesonBuildType = "release";

  mesonFlags = disableFlags ++ basicFlags ++ extraFlags;

}
