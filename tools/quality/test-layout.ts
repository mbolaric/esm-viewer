const testFilePattern = /\.(?:spec|test)\.[cm]?[jt]sx?$/u;

export function findTestLayoutViolations(filePaths: readonly string[]): readonly string[] {
    return filePaths
        .filter((filePath) => testFilePattern.test(filePath))
        .filter((filePath) => {
            const segments = filePath.replaceAll('\\', '/').split('/');
            return !segments.includes('__tests__') || !filePath.endsWith('.test.ts');
        })
        .sort();
}
