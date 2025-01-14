BEGIN {
    print("export default <{[color: string]: [number, number, number]}>{")
}

END {
    print("};");
}

/^static const ColorEntry color_table/ {
    IN_TABLE = 1
}

IN_TABLE && match($0, /\{\s*"(.*)"\s*,\s*\{\s*([^,]+, [^,]+, [^ ]+)/, m) {
    printf("\t%s: [%s],\n", tolower(m[1]), m[2])
}

IN_TABLE && /^}/ {
    exit
}
