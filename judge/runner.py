"""Trusted container supervisor. Receives source + ONE input, never expected outputs."""
import json, os, subprocess, time, resource, signal

OUTPUT_LIMIT = 65536
data = json.loads(input())
os.chmod('/work', 0o777)
language = data['language']
filename = {'cpp17': 'main.cpp', 'python3': 'main.py', 'java17': 'Main.java'}[language]
with open('/work/' + filename, 'w') as f:
    f.write(data['source'])

def limits():
    resource.setrlimit(resource.RLIMIT_FSIZE, (OUTPUT_LIMIT, OUTPUT_LIMIT))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))
    resource.setrlimit(resource.RLIMIT_CPU, (10, 11))

def execute(command, timeout, compile=False):
    # Separate child UID prevents submitted code from accessing supervisor /proc FDs.
    out_path='/work/compile.out' if compile else '/work/run.out'
    err_path='/work/compile.err' if compile else '/work/run.err'
    with open(out_path,'wb') as out, open(err_path,'wb') as err:
        p=subprocess.Popen(command, stdin=subprocess.PIPE, stdout=out, stderr=err,
            cwd='/work', env={'PATH':os.environ.get('PATH', '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'),'HOME':'/work','LANG':'C.UTF-8'},
            user=1001, group=1001, extra_groups=[], start_new_session=True, preexec_fn=limits)
        try:
            p.communicate(b'' if compile else data['input'].encode(), timeout=timeout)
        except subprocess.TimeoutExpired:
            os.killpg(p.pid, signal.SIGKILL)
            p.wait()
            return 'time-limit-exceeded', '', ''
    with open(out_path,'rb') as f: output=f.read(OUTPUT_LIMIT).decode(errors='replace')
    with open(err_path,'rb') as f: error=f.read(OUTPUT_LIMIT).decode(errors='replace')
    if os.path.getsize(out_path)>=OUTPUT_LIMIT or os.path.getsize(err_path)>=OUTPUT_LIMIT or p.returncode==-signal.SIGXFSZ:
        return 'output-limit-exceeded', output, error
    if p.returncode:
        if 'OutOfMemoryError' in error or 'MemoryError' in error or p.returncode==-signal.SIGKILL:
            return 'memory-limit-exceeded', output, error
        return ('compilation-error' if compile else 'runtime-error'), output, error
    return 'ok', output, error

started=time.monotonic()
try:
    if language=='cpp17':
        status,out,err=execute(['g++','-std=c++17','-O2','-pipe',filename,'-o','/work/program'],15,True)
        command=['/work/program']
    elif language=='java17':
        status,out,err=execute(['javac','-J-Xmx192m',filename],15,True)
        heap=max(16,int(data['memoryLimitMb'])//2)
        command=['java',f'-Xmx{heap}m','-Xms16m','-XX:MaxMetaspaceSize=64m','-XX:ReservedCodeCacheSize=32m','-XX:+UseSerialGC','-XX:ActiveProcessorCount=1','-cp','/work','Main']
    else:
        status,out,err='ok','',''
        command=['python3','-I','/work/main.py']
    if status=='ok':
        started=time.monotonic()
        status,out,err=execute(command,data['timeLimitMs']/1000)
    print(json.dumps({'status':status,'output':out,'error':err,'executionTimeMs':round((time.monotonic()-started)*1000)}))
except Exception as e:
    print(json.dumps({'status':'judging-error','output':'','error':str(e),'executionTimeMs':0}))
