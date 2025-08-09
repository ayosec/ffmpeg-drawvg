export default class Scanner {
    source: string;

    constructor(source: string) {
        this.source = source;
    }

    scan(re: RegExp) {
        const m = re.exec(this.source);
        if (m && m.index === 0) {
            const lexeme = m[0];
            this.source = this.source.substring(lexeme.length);
            return lexeme;
        }
    }

    whitespace() {
        return this.scan(/\s+/) ?? "";
    }

    tail() {
        return this.source;
    }

    end() {
        return this.source === "";
    }

}
