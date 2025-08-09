# Add an explicit `-I$SYSROOT/include` because ccls does
# not recognize --sysroot.

def sysroot:
    .arguments
        | map(select(startswith("--sysroot=")))
        | first
        | split("=")
        | last
        ;

map(.arguments += ["-I\(.|sysroot)/include"])
