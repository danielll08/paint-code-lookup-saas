<#
.SYNOPSIS
    OpenCode Orchestrator for PowerShell
.DESCRIPTION
    Script điều phối OpenCode: tìm phiên theo CWD, đóng gói prompt ràng buộc an toàn,
    gửi việc vào hàng đợi và theo dõi tiến độ đến khi hoàn tất.
#>

param(
    [Parameter(Position=0)]
    [ValidateSet("Find", "Send", "Watch", "Orchestrate", "Status", "Interrupt")]
    [string]$Action = "Find",

    [Parameter(Position=1)]
    [string]$Task = "",

    [Parameter()]
    [string]$SessionId = "",

    [Parameter()]
    [string]$Directory = $PWD.Path,

    [Parameter()]
    [string]$Marker = "XONG-TOAN-BO"
)

$OpenCodeExe = "$env:APPDATA\npm\node_modules\@opencode\cli\bin\opencode.exe"
if (-not (Test-Path $OpenCodeExe)) {
    $cmd = Get-Command opencode -ErrorAction SilentlyContinue
    if ($cmd) { $OpenCodeExe = $cmd.Source } else { $OpenCodeExe = "opencode" }
}

function Invoke-OpenCodeApi {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null
    )
    $argsList = @("api", $Method, $Path)
    if ($null -ne $Body) {
        $json = $Body | ConvertTo-Json -Compress
        $argsList += @("-d", $json)
    }
    $raw = & $OpenCodeExe @argsList 2>&1
    try {
        return ($raw | Out-String | ConvertFrom-Json)
    } catch {
        return $raw
    }
}

function Get-TargetSession {
    param([string]$TargetDir)
    $res = Invoke-OpenCodeApi -Method "GET" -Path "/api/session"
    if (-not $res -or -not $res.data) { return $null }
    
    $normalized = [System.IO.Path]::GetFullPath($TargetDir).TrimEnd('\', '/').ToLowerInvariant()
    $matches = $res.data | Where-Object {
        if ($_.location -and $_.location.directory) {
            $sessionDir = [System.IO.Path]::GetFullPath($_.location.directory).TrimEnd('\', '/').ToLowerInvariant()
            return $sessionDir -eq $normalized
        }
        return $false
    } | Sort-Object { $_.time.updated } -Descending

    if ($matches) {
        return @($matches)[0]
    }
    return ($res.data | Sort-Object { $_.time.updated } -Descending)[0]
}

function Format-GuardedPrompt {
    param([string]$RawTask, [string]$CompletionMarker)
    return @"
[NHIỆM VỤ ĐIỀU PHỐI / ORCHESTRATION TASK]
$RawTask

---
[RÀNG BUỘC BẮT BUỘC / STRICT CONSTRAINTS]:
1. KHÔNG rewrite git history (tuyệt đối không git reset --hard, không git push -f, không rebase).
2. KHÔNG tự ý push lên remote repository hoặc xóa branch.
3. KHÔNG chỉnh sửa hoặc in lộ nội dung các file bí mật (.env, .env.local, tokens, credentials).
4. Nếu gặp bất kỳ điểm nào mơ hồ hoặc rủi ro cao: DỪNG LẠI và hỏi/chờ xác nhận, không được tự suy đoán.
5. Báo cáo ngắn gọn tiến độ sau mỗi bước hoàn thành.
6. Khi đã hoàn tất TOÀN BỘ công việc được giao, hãy kết thúc câu trả lời cuối cùng bằng chính xác chuỗi: $CompletionMarker
"@
}

switch ($Action) {
    "Find" {
        $s = Get-TargetSession -TargetDir $Directory
        $s | ConvertTo-Json -Depth 4
    }
    "Status" {
        if (-not $SessionId) {
            $target = Get-TargetSession -TargetDir $Directory
            if ($target) { $SessionId = $target.id }
        }
        $info = Invoke-OpenCodeApi -Method "GET" -Path "/api/session/$SessionId"
        $perms = Invoke-OpenCodeApi -Method "GET" -Path "/api/session/$SessionId/permission"
        [PSCustomObject]@{
            Session = $info.data
            PendingPermissions = $perms.data
        } | ConvertTo-Json -Depth 4
    }
    "Send" {
        if (-not $SessionId) {
            $target = Get-TargetSession -TargetDir $Directory
            if ($target) { $SessionId = $target.id }
        }
        if (-not $SessionId -or -not $Task) {
            Write-Error "SessionId và Task không được để trống."
            exit 1
        }
        $guarded = Format-GuardedPrompt -RawTask $Task -CompletionMarker $Marker
        $body = @{ text = $guarded; resume = $true }
        $res = Invoke-OpenCodeApi -Method "POST" -Path "/api/session/$SessionId/prompt" -Body $body
        Write-Host "Đã gửi nhiệm vụ vào session: $SessionId"
        $res | ConvertTo-Json
    }
    "Interrupt" {
        if (-not $SessionId) {
            $target = Get-TargetSession -TargetDir $Directory
            if ($target) { $SessionId = $target.id }
        }
        $res = Invoke-OpenCodeApi -Method "POST" -Path "/api/session/$SessionId/interrupt"
        Write-Host "Đã gửi tín hiệu ngắt (interrupt) tới session $SessionId"
    }
    "Orchestrate" {
        if (-not $Task) {
            Write-Error "Vui lòng truyền vào nội dung -Task."
            exit 1
        }
        $target = Get-TargetSession -TargetDir $Directory
        if (-not $target) {
            Write-Error "Không tìm thấy session OpenCode nào cho thư mục $Directory"
            exit 1
        }
        $targetId = $target.id
        Write-Host "==========================================" -ForegroundColor Cyan
        Write-Host " ORCHESTRATING OPENCODE SESSION: $targetId" -ForegroundColor Cyan
        Write-Host " Project: $($target.location.directory)" -ForegroundColor Cyan
        Write-Host "==========================================" -ForegroundColor Cyan
        
        $nodeScript = "$PSScriptRoot\opencode_orchestrator.mjs"
        if (Test-Path $nodeScript) {
            node $nodeScript orchestrate $Task
        } else {
            $guarded = Format-GuardedPrompt -RawTask $Task -CompletionMarker $Marker
            Invoke-OpenCodeApi -Method "POST" -Path "/api/session/$targetId/prompt" -Body @{ text = $guarded; resume = $true }
            Write-Host "Nhiệm vụ đã được đưa vào hàng đợi. Kiểm tra lại bằng: .\opencode_orchestrator.ps1 Status -SessionId $targetId"
        }
    }
}
