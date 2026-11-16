$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Nexo - Panel Administrativo.lnk"

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "C:\Nexo\ABRIR-PANEL.bat"
$shortcut.WorkingDirectory = "C:\Nexo"
$shortcut.IconLocation = "C:\Nexo\public\favicon.ico,0"
$shortcut.Description = "Panel Administrativo Nexo"
$shortcut.Save()

Write-Output "Acceso directo creado en: $shortcutPath"
