$names = @('postgresql-x64-15','postgresql-x64-14','postgresql-x64-13','postgresql')
foreach($n in $names){
  $svc = Get-Service -Name $n -ErrorAction SilentlyContinue
  if($svc){
    try{ Start-Service $n -ErrorAction Stop }catch{}
    $s = (Get-Service -Name $n).Status
    Write-Host "$n : $s"
  } else {
    Write-Host "$n : NotFound"
  }
}
