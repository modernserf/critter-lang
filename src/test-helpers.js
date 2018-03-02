// the cursor positions are not expected to match.
expect.extend({
    toMatchParseResult (received, arg) {
        if (received instanceof Object && arg instanceof Object) {
            for (const key in received) {
                if (['from', 'to'].includes(key)) { continue }
                expect(received[key]).toMatchParseResult(arg[key])
            }
        } else {
            expect(received).toEqual(arg)
        }
        return {
            pass: true,
            message: () => `expected ${received} not to have matched ${arg}`,
        }
    },
})
