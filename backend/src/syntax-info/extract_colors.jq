def name:
    .inner[0]
    .inner[0]
    .inner[0]
    .value
        | fromjson
        | ascii_downcase
    ;

def comps:
    .inner[1]
    .inner
        | map(
            .inner[]
            .value
                | fromjson
        )
    ;

select(.kind == "VarDecl")
    .inner[0]
    .inner
        | map({ (name): comps })
        | add
