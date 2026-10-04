// Bounded actual operation timings, exported with normal local diagnostics.
use serde::Serialize;
use std::collections::VecDeque;
use std::sync::Mutex;
use std::time::{Instant,SystemTime,UNIX_EPOCH};
#[derive(Clone,Serialize)]
#[serde(rename_all="camelCase")]
pub struct Sample {kind:String, unix_ms:u128, duration_ms:u128, details:serde_json::Value}
static SAMPLES:Mutex<VecDeque<Sample>>=Mutex::new(VecDeque::new());
pub fn record(kind:&str,started:Instant,details:serde_json::Value){
    if let Ok(mut samples)=SAMPLES.lock(){
        if samples.len()>=64{samples.pop_front();}
        samples.push_back(Sample{kind:kind.into(),unix_ms:SystemTime::now().duration_since(UNIX_EPOCH).map(|v|v.as_millis()).unwrap_or(0),
            duration_ms:started.elapsed().as_millis(),details});
    }
}
pub fn samples()->Vec<Sample>{SAMPLES.lock().map(|s|s.iter().cloned().collect()).unwrap_or_default()}