UPDATE public.programs
SET silent_install_args = '/S',
    silent_uninstall_args = '/S'
WHERE installer_path = '92c4efac-dd9e-4d4d-b618-61fb2e958054-7z2601-x64.exe';