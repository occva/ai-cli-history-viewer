[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Path
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not (Test-Path -LiteralPath $Path)) {
  throw "Release notes file not found: $Path"
}

$content = Get-Content -LiteralPath $Path -Raw
if (-not $content.Trim()) {
  throw "Release notes file is empty: $Path"
}

$changesMatch = [regex]::Match(
  $content,
  '(?ms)^## Changes\s*(?<body>.*?)(?=^##\s|\z)'
)
if (-not $changesMatch.Success -or -not $changesMatch.Groups['body'].Value.Trim()) {
  throw "Release notes must include a non-empty ## Changes section: $Path"
}

if ([regex]::IsMatch($content, '(?i)\bTODO\b')) {
  throw "Release notes are not publish-ready: found TODO placeholder text in $Path"
}
