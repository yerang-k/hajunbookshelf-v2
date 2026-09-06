// Google Apps Script Web App — 하준이의 책장 백업/복원용 시트 저장소
//
// 시트 구조 (첫 번째 시트, 헤더 행 1개):
// isbn | title | author | publisher | cover | link | date | emoji | note | ts | language
//
// 설정:
// 1. 새 구글 스프레드시트를 만든다.
// 2. 확장 프로그램 > Apps Script 에서 이 파일 내용을 Code.gs에 붙여넣는다.
// 3. 프로젝트 설정 > 스크립트 속성에 WRITE_KEY 를 추가하고 임의의 긴 문자열을 값으로 넣는다.
//    (index.html의 WRITE_KEY 상수와 동일한 값이어야 한다)
// 4. 배포 > 새 배포 > 웹 앱 선택, 실행 계정: 나, 액세스 권한: 전체 공개(anyone) 로 배포한다.
// 5. 배포 후 나오는 /exec URL을 index.html의 API_URL 상수에 붙여넣는다.
//
// ⚠️ 코드를 수정한 뒤에는 "새 배포"가 아니라 배포 관리 > 수정 > 새 버전으로 갱신할 것.
// "새 배포"를 만들면 /exec 주소가 바뀌어 index.html이 가리키는 주소가 죽는다.

var HEADERS = ['isbn', 'title', 'author', 'publisher', 'cover', 'link', 'date', 'emoji', 'note', 'ts', 'language'];

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function doGet(e) {
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return json_([]);
  var values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  var rows = values.map(function (r) {
    var obj = {};
    HEADERS.forEach(function (h, i) { obj[h] = r[i]; });
    return obj;
  }).filter(function (r) { return r.isbn; });
  return json_(rows);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var body = JSON.parse(e.postData.contents);
    var writeKey = PropertiesService.getScriptProperties().getProperty('WRITE_KEY');
    if (!writeKey || body.key !== writeKey) {
      return json_({ error: '권한이 없어요.' });
    }

    var sheet = getSheet_();

    if (body.action === 'add') {
      sheet.appendRow([
        body.isbn || '', body.title || '', body.author || '', body.publisher || '',
        body.cover || '', body.link || '', body.date || '', body.emoji || '', body.note || '', body.ts || '',
        body.language || ''
      ]);
      return json_({ ok: true });
    }

    if (body.action === 'deleteRead') {
      deleteRows_(sheet, function (isbn, ts) { return String(isbn) === String(body.isbn) && String(ts) === String(body.ts); });
      return json_({ ok: true });
    }

    if (body.action === 'deleteBook') {
      deleteRows_(sheet, function (isbn) { return String(isbn) === String(body.isbn); });
      return json_({ ok: true });
    }

    return json_({ error: '알 수 없는 action이에요.' });
  } finally {
    lock.releaseLock();
  }
}

function deleteRows_(sheet, matchFn) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var isbnCol = HEADERS.indexOf('isbn');
  var tsCol = HEADERS.indexOf('ts');
  var values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    if (matchFn(values[i][isbnCol], values[i][tsCol])) {
      sheet.deleteRow(2 + i);
    }
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
