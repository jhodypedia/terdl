// theme switch (save via hidden POST to /admin/settings is optional; here immediate apply)
document.getElementById('themeSelect')?.addEventListener('change', async (e)=>{
  const v = e.target.value;
  document.documentElement.setAttribute('data-theme', v);
  try {
    // persist via minimal POST (will not change other settings)
    const body = new URLSearchParams({ THEME: v });
    await fetch('/admin/settings', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body });
    Swal.fire({toast:true, position:'top-end', timer:1200, showConfirmButton:false, icon:'success', title:'Theme updated'});
  } catch {}
});
