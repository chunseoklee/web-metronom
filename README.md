# 고정밀 프리미엄 웹 메트로놈 (Web Metronome)

웹 브라우저에서 바로 실행할 수 있는 고정밀 메트로놈 애플리케이션입니다. **Web Audio API**와 **Web Worker(백그라운드 타이머 스레드)**를 결합하여 백그라운드 탭에서도 밀림 없는 정확한 박자를 보장하며, 현대적이고 직관적인 네온 다크 테마 디자인을 제공합니다.

![Metronome Interface Preview](https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80) <!-- placeholder/concept decoration -->

## 주요 기능

1. **정밀 오디오 스케줄링**: 브라우저 메인 스레드의 부하에 방해받지 않는 독립된 웹 워커 타이밍 엔진.
2. **다양한 소리 테마**: 우드블록(Woodblock), 디지털 비프(Digital Beep), 스네어 림샷(Snare Rimshot) 합성 오디오 지원.
3. **박자(Time Signature) 및 분할(Subdivisions)**:
   - 박자 설정: 2/4, 3/4, 4/4, 6/8
   - 음표 분할: 4분음표, 8분음표, 셋잇단음표, 16분음표
4. **탭 템포 (Tap Tempo)**: 실시간으로 탭 속도를 계산하여 원하는 BPM으로 빠르게 맞춰주는 탭 기능.
5. **연습 타이머**: 1분, 3분, 5분 등의 세션 타이머 설정 기능 (타이머 종료 시 따뜻한 차임벨 알림 소리 제공).
6. **동적 비주얼라이저**:
   - 악센트 박(강박)과 약박이 구분되는 직관적인 LED 도트 인디케이터.
   - 템포에 맞춰 좌우로 부드럽게 왕복하는 정밀 스위핑 스윙 바(진자 효과).
7. **BPM 신속 조절**: 슬라이더, +1/-1, +10/-10 버튼, 프리셋 버튼 및 BPM 수치 직접 클릭 입력 기능 지원.

---

## 로컬 실행 방법

브라우저의 보안 정책상 **Web Worker** 기능은 파일 시스템(`file://`)에서 직접 열 경우 실행되지 않을 수 있으므로, 반드시 **웹 서버**를 통해 실행해야 합니다.

### Python을 이용한 실행 (가장 간편함)
Python이 설치되어 있다면 프로젝트 폴더에서 아래 명령을 실행합니다.

```bash
python -m http.server 8000
```
그 후 브라우저를 열고 `http://localhost:8000`에 접속합니다.

### VS Code 라이브 서버 (Live Server Extension)
VS Code를 사용 중이라면 **Live Server** 확장을 설치한 후 오른쪽 아래의 `Go Live` 버튼을 클릭하여 실행할 수 있습니다.

---

## GitHub Pages (`github.io`) 배포 방법

이 프로젝트는 별도의 빌드 과정이 필요 없는 정적 웹 애플리케이션으로, GitHub Pages에 아주 쉽게 배포할 수 있습니다.

1. **GitHub 저장소 생성**:
   - GitHub 사이트에서 새로운 public 저장소(Repository)를 생성합니다 (예: `web-metronome`).
2. **코드 업로드 (Push)**:
   - 로컬 작업 폴더에서 git을 초기화하고 커밋한 후 GitHub 저장소에 올립니다.
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/사용자이름/저장소이름.git
   git push -u origin main
   ```
3. **GitHub Pages 활성화**:
   - GitHub 저장소 웹 페이지에서 **Settings** -> **Pages** 메뉴로 이동합니다.
   - **Build and deployment** 섹션의 Source를 `Deploy from a branch`로 설정합니다.
   - Branch를 `main` (또는 `master`) / `/ (root)`로 선택하고 **Save** 버튼을 클릭합니다.
4. **배포 확인**:
   - 잠시 후 (약 1~2분 소요) 설정 페이지 상단에 배포된 URL 주소가 나타납니다.
   - `https://사용자이름.github.io/저장소이름/` 형식의 주소로 접속하면 브라우저에서 바로 사용하실 수 있습니다.

---

## 키보드 단축키

메트로놈 조작의 편의성을 위해 단축키를 기본 탑재하고 있습니다:

- `Spacebar`: 메트로놈 시작 및 정지
- `T` 키: 탭 템포 (박자에 맞춰 입력 시 자동 BPM 감지)
- `↑` (방향키 위): BPM 1 증가
- `↓` (방향키 아래): BPM 1 감소

## 기술 스택
- **Structure**: HTML5 (접근성을 고려한 시맨틱 태그)
- **Styling**: Vanilla CSS (CSS Variables, Flexbox, Grid, Glassmorphism, Keyframes Animation)
- **Logic & Audio**: Vanilla JS, Web Audio API, Web Workers (inline blob)
